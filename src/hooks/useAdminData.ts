import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from '../utils/useQueryCache';

export function useAdminProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const [projRes, supRes, teamsRes, teamMembersRes, studentsRes] = await Promise.all([
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/supervisors').catch(() => ({ data: [] })),
        api.get('/teams').catch(() => ({ data: [] })),
        api.get('/team-members').catch(() => ({ data: [] })),
        api.get('/students').catch(() => ({ data: [] })),
      ]);

      const allProjects = projRes.data || [];
      const allSupervisors = supRes.data || [];
      const allTeams = teamsRes.data || [];
      const allTeamMembers = teamMembersRes.data || [];
      const allStudents = studentsRes.data || [];

      const parseIdArray = (value?: string | null): string[] => {
        try {
          const parsed = JSON.parse(value || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      const sups = allSupervisors.map((sup: any) => ({
        ...sup,
        assignedCount: allProjects.filter((p: any) => p.supervisorId === sup.supervisorId).length,
      }));

      const enriched = allProjects.map((p: any) => {
        const team = allTeams.find((t: any) => t.teamId === p.teamId);
        let memberDetails: any[] = [];
        let leaderName = '—';
        if (team) {
          const memberStatus = allTeamMembers.find((tm: any) => tm.teamId === team.teamId);
          const joinedIds = new Set(parseIdArray(memberStatus?.joinMemberArray));
          const pendingIds = new Set(parseIdArray(memberStatus?.notJoinMemberArray));
          const arr = Array.from(
            new Set(
              [...parseIdArray(team.teamMemberArray), ...Array.from(joinedIds), ...Array.from(pendingIds), team.leaderId].filter(
                Boolean
              )
            )
          );
          memberDetails = arr.map((sid: string) => {
            const st = allStudents.find((s: any) => s.studentId === sid);
            return {
              ...(st || { studentId: sid, name: 'Unknown', mail: 'N/A' }),
              inviteStatus:
                sid === team.leaderId ? 'LEADER' : pendingIds.has(sid) ? 'PENDING' : joinedIds.has(sid) ? 'APPROVED' : 'PENDING',
            };
          });
          const leader = allStudents.find((s: any) => s.studentId === team.leaderId);
          leaderName = leader?.name || '—';
        }
        return { ...p, team, memberDetails, leaderName };
      });

      return { projects: enriched, supervisors: sups };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminStudents() {
  return useQuery({
    queryKey: queryKeys.students,
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminSupervisors() {
  return useQuery({
    queryKey: queryKeys.supervisors,
    queryFn: async () => {
      const res = await api.get('/supervisors');
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminForms() {
  return useQuery({
    queryKey: queryKeys.forms,
    queryFn: async () => {
      const res = await api.get('/forms');
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: async () => {
      const res = await api.get('/teams');
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}