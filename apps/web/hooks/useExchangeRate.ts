import { useQuery } from '@tanstack/react-query';

export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const response = await fetch('/api/rates');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      return data.rate as number;
    },
    staleTime: 60 * 1000, // 60 seconds
  });
}
