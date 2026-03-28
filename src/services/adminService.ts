import { api } from './api';

export interface FormCreateRequest {
  accessBranch: string;
  accessBatch: string;
  jsonOfFields: string;
  createdBy: string;
}

export interface FormResponse {
  formId: string;
  accessBranch: string;
  accessBatch: string;
  jsonOfFields: string;
  createdBy: string;
  createAt: string;
}

export const adminService = {
  createForm: async (data: FormCreateRequest): Promise<FormResponse> => {
    const response = await api.post<FormResponse>('/forms', data);
    return response.data;
  },

  getAllForms: async (): Promise<FormResponse[]> => {
    const response = await api.get<FormResponse[]>('/forms');
    return response.data;
  },

  getForm: async (formId: string): Promise<FormResponse> => {
    const response = await api.get<FormResponse>(`/forms/${formId}`);
    return response.data;
  },

  getAllProjects: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/projects');
    return response.data;
  }
};
