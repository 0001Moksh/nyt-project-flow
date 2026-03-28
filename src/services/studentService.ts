import { api } from './api';
import type { FormResponse } from './adminService';

export interface TeamCreateRequest {
  leaderId: string;
  teamMemberIds: string[];
  teamCompleteStatus: boolean;
}

export interface TeamResponse {
  teamId: string;
  leaderId: string;
  teamCompleteStatus: boolean;
  teamMemberArray: string;
}

export interface ProjectCreateRequest {
  teamId: string;
  formId: string;
  projectTitle: string;
  projectDescription: string;
}

export interface ProjectResponse {
  projectId: string;
  teamId: string;
  formId: string;
  projectTitle: string;
  projectDescription: string;
  status: string;
  createdAt: string;
}

export const studentService = {
  getFormDetails: async (formId: string): Promise<FormResponse> => {
    const response = await api.get<FormResponse>(`/forms/${formId}`);
    return response.data;
  },

  createTeam: async (data: TeamCreateRequest): Promise<TeamResponse> => {
    const response = await api.post<TeamResponse>('/teams', data);
    return response.data;
  },

  createProject: async (data: ProjectCreateRequest): Promise<ProjectResponse> => {
    const response = await api.post<ProjectResponse>('/projects', data);
    return response.data;
  }
};
