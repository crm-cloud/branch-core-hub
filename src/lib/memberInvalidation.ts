import type { QueryClient } from '@tanstack/react-query';

const MEMBER_QUERY_PREFIXES = [
  'members',
  'member-memberships',
  'member-details',
  'dashboard-stats',
  'membership-distribution',
];

export function invalidateMembersData(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey?.[0];
      return typeof key === 'string' && MEMBER_QUERY_PREFIXES.includes(key);
    },
    refetchType: 'active',
  });
}
