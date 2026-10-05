import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { IVtigerProvider, VtigerMatch } from '../interfaces';

export class VtigerClient implements IVtigerProvider {
  private client: AxiosInstance;
  private sessionName: string | null = null;
  private sessionExpiresAt = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly accessKey: string
  ) {
    this.client = axios.create({
      baseURL: this.baseUrl.replace(/\/+$/, ''),
      timeout: 10000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  }

  private async getChallenge(): Promise<string> {
    const res = await this.client.get('/webservice.php', {
      params: { operation: 'getchallenge', username: this.username }
    });
    if (!res.data?.success) {
      throw new Error(
        `VTIGER_CHALLENGE_FAILED: ${res.data?.error?.message || 'Empty response'}`
      );
    }
    return res.data.result.token;
  }

  public async authenticate(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh &&
      this.sessionName &&
      Date.now() < this.sessionExpiresAt
    ) {
      return this.sessionName;
    }

    const token = await this.getChallenge();
    const hash = crypto
      .createHash('md5')
      .update(token + this.accessKey)
      .digest('hex');

    const params = new URLSearchParams();
    params.append('operation', 'login');
    params.append('username', this.username);
    params.append('accessKey', hash);

    const loginRes = await this.client.post('/webservice.php', params.toString());
    if (!loginRes.data?.success) {
      throw new Error(
        `VTIGER_LOGIN_FAILED: ${loginRes.data?.error?.message || 'Access denied'}`
      );
    }

    this.sessionName = loginRes.data.result.sessionName;
    this.sessionExpiresAt = Date.now() + 50 * 60 * 1000;
    return this.sessionName!;
  }

  private async executeVQL(query: string): Promise<any[]> {
    let session = await this.authenticate();
    try {
      const res = await this.client.get('/webservice.php', {
        params: { operation: 'query', sessionName: session, query }
      });
      if (res.data?.success) return res.data.result;

      if (res.data?.error?.code === 'INVALID_SESSION') {
        session = await this.authenticate(true);
        const retryRes = await this.client.get('/webservice.php', {
          params: { operation: 'query', sessionName: session, query }
        });
        if (retryRes.data?.success) return retryRes.data.result;
        throw new Error(
          retryRes.data?.error?.message || 'Vtiger Query Failed After Retry'
        );
      }
      throw new Error(res.data?.error?.message || 'Vtiger Query Failed');
    } catch (err: any) {
      throw new Error(`VTIGER_API_ERROR: ${err.message}`);
    }
  }

  public async findEntityByPhone(nationalNumber: string): Promise<VtigerMatch | null> {
    const contactVql = `SELECT id, firstname, lastname, email, phone, mobile, assigned_user_id FROM Contacts WHERE mobile LIKE '%${nationalNumber}%' OR phone LIKE '%${nationalNumber}%' LIMIT 1;`;
    const contacts = await this.executeVQL(contactVql);

    if (contacts && contacts.length > 0) {
      const c = contacts[0];
      const [moduleId, recordId] = (c.id as string).split('x');
      return {
        compoundId: c.id,
        moduleId,
        recordId,
        moduleName: 'Contacts',
        fullName: `${c.firstname || ''} ${c.lastname || ''}`.trim() || 'Contact',
        phone: c.mobile || c.phone || '',
        email: c.email || '',
        assignedUserId: c.assigned_user_id || ''
      };
    }

    const leadVql = `SELECT id, firstname, lastname, email, phone, mobile, assigned_user_id FROM Leads WHERE mobile LIKE '%${nationalNumber}%' OR phone LIKE '%${nationalNumber}%' LIMIT 1;`;
    const leads = await this.executeVQL(leadVql);

    if (leads && leads.length > 0) {
      const l = leads[0];
      const [moduleId, recordId] = (l.id as string).split('x');
      return {
        compoundId: l.id,
        moduleId,
        recordId,
        moduleName: 'Leads',
        fullName: `${l.firstname || ''} ${l.lastname || ''}`.trim() || 'Lead',
        phone: l.mobile || l.phone || '',
        email: l.email || '',
        assignedUserId: l.assigned_user_id || ''
      };
    }

    return null;
  }

  public async createLead(data: {
    firstName: string;
    lastName: string;
    mobile: string;
    email?: string;
    company?: string;
    source?: string;
  }): Promise<string> {
    const session = await this.authenticate();
    const element = {
      firstname: data.firstName,
      lastname: data.lastName || 'WhatsApp Lead',
      mobile: data.mobile,
      email: data.email || '',
      company: data.company || '',
      leadsource: data.source || 'WhatsApp',
      leadstatus: 'New'
    };

    const params = new URLSearchParams();
    params.append('operation', 'create');
    params.append('sessionName', session);
    params.append('elementType', 'Leads');
    params.append('element', JSON.stringify(element));

    const res = await this.client.post('/webservice.php', params.toString());
    if (!res.data?.success) {
      throw new Error(`VTIGER_CREATE_LEAD_FAILED: ${res.data?.error?.message}`);
    }
    return res.data.result.id;
  }
}
