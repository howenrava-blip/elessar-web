-- ============================================================================
-- ELESSÄR — Actualización 22/10/2026: pagos administrables + pedidos por WhatsApp
-- Correr UNA vez en Supabase → SQL Editor → New query → Run.
-- (Si instalás desde cero, ya viene incluido en schema.sql.)
-- ============================================================================

-- Permite que un ADMIN marque como pagado un pedido manual (WhatsApp, efectivo
-- en un show…) y descuente el stock. Reutiliza apply_paid_order (idempotente).
create or replace function public.admin_apply_paid_order(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administradores';
  end if;
  return public.apply_paid_order(p_order_id, null);
end; $$;

revoke all on function public.admin_apply_paid_order(uuid) from public, anon;
grant execute on function public.admin_apply_paid_order(uuid) to authenticated;
