import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from '../utils/useQueryCache';

export function useAdminProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const [projRes, supRes, teamsRes, teamMembersRes, studentsRes, formsRes] = await Promise.all([
        api.get('/projects'),
        api.get('/supervisors'),
        api.get('/teams'),
        api.get('/team-members'),
        api.get('/students'),
        api.get('/forms'),
      ]);

      const allProjects = projRes.data || [];
      const allSupervisors = supRes.data || [];
      const allTeams = teamsRes.data || [];
      const allTeamMembers = teamMembersRes.data || [];
      const allStudents = studentsRes.data || [];
      const teamsById = new Map<string, any>(allTeams.map((t: any) => [t.teamId, t]));
      const membersByTeam = new Map<string, any>(allTeamMembers.map((t: any) => [t.teamId, t]));
      const studentsById = new Map<string, any>(allStudents.map((s: any) => [s.studentId, s]));
      const assignments = new Map<string, number>();
      allProjects.forEach((p: any) => assignments.set(p.supervisorId, (assignments.get(p.supervisorId) || 0) + 1));
      const customFieldLabels: string[] = Array.from(new Set<string>(
        (formsRes.data || []).flatMap((form: any) => {
          try {
            const fields = JSON.parse(form.jsonOfFields || '[]');
            return fields
              .filter((field: any) => {
                const label = String(field.label || '').trim();
                const normalized = label.toLowerCase();
                return label && !normalized.includes('project title') && !normalized.includes('project description');
              })
              .map((field: any) => String(field.label).trim());
          } catch {
            return [];
          }
        }) as string[]
      ));

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
        assignedCount: assignments.get(sup.supervisorId) || 0,
      }));

      const enriched = allProjects.map((p: any) => {
        const team = teamsById.get(p.teamId);
        let memberDetails: any[] = [];
        let leaderName = '—';
        if (team) {
          const memberStatus = membersByTeam.get(team.teamId);
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
            const st = studentsById.get(sid);
            return {
              ...(st || { studentId: sid, name: 'Unknown', mail: 'N/A' }),
              inviteStatus:
                sid === team.leaderId ? 'LEADER' : pendingIds.has(sid) ? 'PENDING' : joinedIds.has(sid) ? 'APPROVED' : 'PENDING',
            };
          });
          const leader = studentsById.get(team.leaderId);
          leaderName = leader?.name || '—';
        }
        return { ...p, team, memberDetails, leaderName };
      });

      return { projects: enriched, supervisors: sups, customFieldLabels };
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
