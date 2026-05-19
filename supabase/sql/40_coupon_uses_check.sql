-- Auditoria 2026-05-18 — defesa em profundidade.
-- Garante que uses_count nunca ultrapassa max_uses no DB, mesmo que
-- app-layer (incrementCouponUses) tenha bug. Pattern Vitrê: DROP IF
-- EXISTS + ADD (não há ADD CONSTRAINT IF NOT EXISTS em Postgres).
--
-- Pareado com auditoria S5 (cupom race): incrementCouponUses agora roda
-- UPDATE atomic com WHERE max_uses IS NULL OR uses_count < max_uses
-- RETURNING. Esta constraint pega bug se algum caller futuro escapar
-- desse pattern.

ALTER TABLE "coupon" DROP CONSTRAINT IF EXISTS coupon_uses_within_max;
ALTER TABLE "coupon" ADD CONSTRAINT coupon_uses_within_max
  CHECK (max_uses IS NULL OR uses_count <= max_uses);
