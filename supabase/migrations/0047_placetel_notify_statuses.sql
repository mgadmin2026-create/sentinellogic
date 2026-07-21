-- Offizielle Placetel-Notify-Auflegegründe vollständig im Anrufprotokoll abbilden.

alter table public.call_logs
  drop constraint if exists call_logs_status_check;

alter table public.call_logs
  add constraint call_logs_status_check check (status in (
    'initiated', 'ringing', 'accepted', 'completed',
    'missed', 'blocked', 'voicemail', 'busy',
    'canceled', 'unavailable', 'congestion', 'failed'
  ));
