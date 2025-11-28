import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X } from "lucide-react";
import type { Task } from "./TaskCard";

interface Suggestion {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  category: string;
  startDate?: Date;
  dueDate?: Date;
  completed: false;
}

interface AISuggestionsProps {
  suggestions: Suggestion[];
  onAccept: (suggestion: Suggestion) => void;
  onReject: (index: number) => void;
  onClearAll: () => void;
}

export const AISuggestions = ({ suggestions, onAccept, onReject, onClearAll }: AISuggestionsProps) => {
  if (suggestions.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugerencias de IA
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Limpiar todo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/50"
          >
            <div className="flex-1 space-y-1">
              <h4 className="font-medium">{suggestion.title}</h4>
              {suggestion.description && (
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              )}
              <div className="flex gap-2">
                <Badge variant={
                  suggestion.priority === 'high' ? 'destructive' :
                  suggestion.priority === 'medium' ? 'default' : 'secondary'
                }>
                  {suggestion.priority === 'high' ? 'Alta' :
                   suggestion.priority === 'medium' ? 'Media' : 'Baja'}
                </Badge>
                <Badge variant="outline">{suggestion.category}</Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => onAccept(suggestion)}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => onReject(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
