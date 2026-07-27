-- Support tickets — owners/coaches contact the platform admin from the back-office.
-- Tables: support_tickets (one per request) + support_messages (thread).
-- Access model:
--   * box staff (box owner or box_members owner/coach) see & manage their OWN box's tickets
--   * support admins (support_admins table + super_admin/admin roles) see & answer ALL tickets
-- Tenant isolation: a box owner/coach can never read another box's tickets.

-- ── helpers ────────────────────────────────────────────────────────────
-- Scoped box staff check (does NOT grant cross-box access, unlike is_box_admin
-- which lets any 'box_owner' role read every box).
CREATE OR REPLACE FUNCTION public.is_box_staff(p_box_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.boxes WHERE id = p_box_id AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.box_members
      WHERE box_id = p_box_id
        AND member_id = auth.uid()
        AND role IN ('owner', 'coach')
        AND COALESCE(status, 'active') = 'active'
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_box_staff(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.support_admins (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_support_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.support_admins WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_support_admin() TO authenticated, service_role;

-- support_admins is only readable by support admins (used to render the admin inbox link).
DROP POLICY IF EXISTS support_admins_read ON public.support_admins;
CREATE POLICY support_admins_read ON public.support_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_support_admin());

-- ── support_tickets ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id           uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  created_by       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type             text NOT NULL DEFAULT 'question'
                     CHECK (type IN ('question', 'bug', 'improvement')),
  subject          text NOT NULL,
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'answered', 'resolved')),
  admin_unread     boolean NOT NULL DEFAULT true,   -- new/updated by requester, admin hasn't read
  requester_unread boolean NOT NULL DEFAULT false,  -- admin replied, requester hasn't read
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_box_id  ON public.support_tickets(box_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_creator ON public.support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON public.support_tickets(status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_read   ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;

CREATE POLICY support_tickets_read ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_support_admin() OR public.is_box_staff(box_id));

CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_box_staff(box_id));

CREATE POLICY support_tickets_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_support_admin() OR public.is_box_staff(box_id))
  WITH CHECK (public.is_support_admin() OR public.is_box_staff(box_id));

-- ── support_messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('requester', 'admin')),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_read   ON public.support_messages;
DROP POLICY IF EXISTS support_messages_insert ON public.support_messages;

CREATE POLICY support_messages_read ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (public.is_support_admin() OR public.is_box_staff(t.box_id))
    )
  );

-- A requester posts only on their box's tickets as 'requester';
-- a support admin posts as 'admin' on any ticket.
CREATE POLICY support_messages_insert ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          (sender_role = 'admin'     AND public.is_support_admin())
          OR (sender_role = 'requester' AND public.is_box_staff(t.box_id))
        )
    )
  );

-- Keep last_message_at + unread flags in sync automatically.
CREATE OR REPLACE FUNCTION public.support_touch_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.sender_role = 'admin' THEN
    UPDATE public.support_tickets
      SET last_message_at = NEW.created_at,
          requester_unread = true,
          status = CASE WHEN status = 'resolved' THEN status ELSE 'answered' END
      WHERE id = NEW.ticket_id;
  ELSE
    UPDATE public.support_tickets
      SET last_message_at = NEW.created_at,
          admin_unread = true,
          status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_touch_ticket ON public.support_messages;
CREATE TRIGGER trg_support_touch_ticket
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_touch_ticket();
