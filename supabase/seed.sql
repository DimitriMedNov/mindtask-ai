-- Datos de ejemplo para el entorno local.
--
-- `supabase start` corre este archivo solo, así que después de levantar el
-- stack ya puedes entrar con:
--
--     correo:      demo@mindtask.local
--     contraseña:  demo123456
--
-- Todo lo que hay aquí es inventado y vive únicamente en tu máquina.

-- Usuario de ejemplo, confirmado para poder entrar sin recibir correo
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  -- GoTrue espera estas columnas como cadena vacía, no como NULL:
  -- si quedan en NULL, el login truena con "Database error querying schema".
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'demo@mindtask.local',
  crypt('demo123456', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Usuario de demostración"}',
  '', '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@mindtask.local"}',
  'email', now(), now()
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Rol de administrador, para ver el sistema completo
INSERT INTO public.user_roles (user_id, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT DO NOTHING;

-- Tareas repartidas entre pendientes y terminadas, con fechas alrededor de hoy
INSERT INTO public.tasks (user_id, title, description, completed, priority, category, start_date, due_date, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Terminar el reporte mensual',        'Cifras de cierre y comparativo contra el mes pasado', false, 'high',   'Trabajo',      CURRENT_DATE,                CURRENT_DATE + 2,  now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 'Preparar la junta del lunes',        'Agenda y material de apoyo',                          false, 'high',   'Trabajo',      CURRENT_DATE + 1,            CURRENT_DATE + 4,  now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'Revisar propuestas de proveedores',  'Comparar tres cotizaciones',                          false, 'medium', 'Trabajo',      CURRENT_DATE + 2,            CURRENT_DATE + 6,  now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'Estudiar una hora',                  'Curso de bases de datos, módulo 4',                   false, 'medium', 'Estudio',      CURRENT_DATE,                CURRENT_DATE + 1,  now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'Correr 5 km',                        'Ritmo cómodo, sin prisa',                             false, 'low',    'Salud',        CURRENT_DATE,                CURRENT_DATE,      now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'Sacar cita con el dentista',         'Limpieza semestral',                                  false, 'low',    'Salud',        CURRENT_DATE + 3,            CURRENT_DATE + 10, now() - interval '5 days'),
  ('11111111-1111-1111-1111-111111111111', 'Pagar servicios del mes',            'Luz, agua e internet',                                true,  'high',   'Personal',     CURRENT_DATE - 4,            CURRENT_DATE - 3,  now() - interval '6 days'),
  ('11111111-1111-1111-1111-111111111111', 'Actualizar el currículum',           'Agregar el último proyecto',                          true,  'medium', 'Personal',     CURRENT_DATE - 7,            CURRENT_DATE - 5,  now() - interval '9 days'),
  ('11111111-1111-1111-1111-111111111111', 'Respaldar la computadora',           'Disco externo y nube',                                true,  'medium', 'Personal',     CURRENT_DATE - 10,           CURRENT_DATE - 9,  now() - interval '12 days'),
  ('11111111-1111-1111-1111-111111111111', 'Cerrar el trimestre contable',       'Conciliación y envío al contador',                    true,  'high',   'Trabajo',      CURRENT_DATE - 14,           CURRENT_DATE - 12, now() - interval '16 days')
ON CONFLICT DO NOTHING;

-- Sesiones de Pomodoro de las últimas dos semanas
INSERT INTO public.pomodoro_sessions (user_id, task_id, duration_minutes, completed, created_at)
SELECT '11111111-1111-1111-1111-111111111111', t.id, 25, true, now() - (g.dias || ' days')::interval
FROM (VALUES (1),(2),(3),(5),(6),(8),(9),(11),(13)) AS g(dias)
CROSS JOIN LATERAL (
  SELECT id FROM public.tasks
  WHERE user_id = '11111111-1111-1111-1111-111111111111'
  ORDER BY created_at
  LIMIT 1 OFFSET (g.dias % 5)
) AS t;

-- Estadísticas del usuario, coherentes con lo anterior
INSERT INTO public.user_stats (user_id, points, level, streak_days, last_activity_date, tasks_completed)
VALUES ('11111111-1111-1111-1111-111111111111', 340, 4, 6, CURRENT_DATE, 4)
ON CONFLICT (user_id) DO UPDATE
  SET points = EXCLUDED.points,
      level = EXCLUDED.level,
      streak_days = EXCLUDED.streak_days,
      last_activity_date = EXCLUDED.last_activity_date,
      tasks_completed = EXCLUDED.tasks_completed;
