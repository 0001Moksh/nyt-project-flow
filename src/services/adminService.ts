import { api } from './api';

export interface FormAttachment {
  attachmentId: string;
  fileName: string;
  fileUrl: string;
  uploadedBy?: string | null;
  uploadedAt?: string;
  source?: 'UPLOAD' | 'LINK' | string;
  stage?: 'SYNOPSIS' | 'PROGRESS1' | 'PROGRESS2' | 'FINAL' | 'ALL' | 'GENERAL' | string;
}

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
  referenceFilesJson?: string;
  createdBy: string;
  createAt: string;
}

export const parseFormAttachments = (json?: string | null): FormAttachment[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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

  getFormAttachments: async (formId: string): Promise<FormAttachment[]> => {
    const response = await api.get<FormAttachment[]>(`/forms/${formId}/attachments`);
    return response.data;
  },

  uploadFormAttachment: async (formId: string, file: File, stage: string, uploadedBy?: string): Promise<FormAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stage);
    if (uploadedBy) {
      formData.append('uploadedBy', uploadedBy);
    }

    const response = await api.post<FormAttachment>(`/forms/${formId}/attachments`, formData);
    return response.data;
  },

  addFormAttachmentLink: async (
    formId: string,
    fileName: string,
    fileUrl: string,
    stage: string,
    uploadedBy?: string
  ): Promise<FormAttachment> => {
    const response = await api.post<FormAttachment>(`/forms/${formId}/attachments/link`, {
      fileName,
      fileUrl,
      stage,
      uploadedBy,
    });
    return response.data;
  },

  deleteFormAttachment: async (formId: string, attachmentId: string): Promise<void> => {
    await api.delete(`/forms/${formId}/attachments/${attachmentId}`);
  },

  getAllProjects: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/projects');
    return response.data;
  }
};
