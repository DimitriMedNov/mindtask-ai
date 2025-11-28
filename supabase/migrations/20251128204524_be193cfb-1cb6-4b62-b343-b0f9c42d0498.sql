-- Add start_date and due_date to tasks table
ALTER TABLE public.tasks
ADD COLUMN start_date DATE,
ADD COLUMN due_date DATE;