import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userTasks } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare context from user tasks
    const tasksContext = userTasks.map((task: any) => 
      `- ${task.title} (${task.category}, ${task.priority} priority)${task.completed ? ' ✓' : ''}`
    ).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente inteligente de productividad. Analiza las tareas del usuario y sugiere 3 nuevas tareas relevantes que podrían ayudarle a ser más productivo. Las sugerencias deben ser específicas, accionables y relacionadas con sus tareas existentes.'
          },
          {
            role: 'user',
            content: `Basándote en estas tareas:\n${tasksContext}\n\nSugiere 3 nuevas tareas que me ayudarían a ser más productivo. Devuelve SOLO un JSON array con este formato exacto:\n[{"title": "título", "priority": "high|medium|low", "category": "categoría"}]`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('Failed to generate task suggestions');
    }

    const data = await response.json();
    
    // Extract JSON from markdown code blocks if present
    let content = data.choices[0].message.content;
    const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }
    
    const suggestions = JSON.parse(content);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-task-suggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});