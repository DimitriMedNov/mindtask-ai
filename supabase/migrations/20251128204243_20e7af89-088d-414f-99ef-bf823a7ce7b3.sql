-- Allow admins to delete any task
CREATE POLICY "Admins can delete any task"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));