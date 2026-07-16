import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const CONTACTS_KEY = ['contacts'];

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  tags: string | null;
  groupName: string | null;
  isFavorite: boolean;
  customFields: string | null;
  createdAt: string;
  sentEmails?: Array<{
    id: string;
    subject: string;
    sentAt: string | null;
    status: string;
  }>;
}

interface CreateContactData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  customFields?: Record<string, string>;
}

interface UpdateContactData extends CreateContactData {
  id: string;
  isFavorite?: boolean;
}

export function useContacts() {
  return useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: async () => {
      const res = await fetch('/api/contacts');
      if (!res.ok) throw new Error('Failed to fetch contacts');
      return res.json() as Promise<Contact[]>;
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContactData) => {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create contact');
      }
      return res.json() as Promise<Contact>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateContactData) => {
      const res = await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update contact');
      }
      return res.json() as Promise<Contact>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete contact');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const res = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || `Failed to delete contact ${id}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useBulkImportContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: Array<any>) => {
      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import contacts');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}
