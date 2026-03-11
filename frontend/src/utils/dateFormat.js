import { format } from 'date-fns';

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd-MMM-yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd-MMM-yyyy hh:mm a');
  } catch {
    return dateStr;
  }
}
