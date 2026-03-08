import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Question {
  id: number;
  text: string;
  is_fill_in_the_blank: boolean;
  choices: {
    id: number;
    text: string;
    is_correct: boolean;
  }[];
}

interface SessionMcqPracticeProps {
  sessionTitle: string;
  questions: Question[];
  onClose: () => void;
}

export function SessionMcqPractice({ sessionTitle, questions, onClose }: SessionMcqPracticeProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = questions[currentIdx];

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedChoiceId(null);
      setShowFeedback(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleSubmit = () => {
    if (selectedChoiceId === null) return;
    
    const choice = currentQuestion.choices.find(c => c.id === selectedChoiceId);
    if (choice?.is_correct) {
      setScore(prev => prev + 1);
    }
    setShowFeedback(true);
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setSelectedChoiceId(null);
    setShowFeedback(false);
    setScore(0);
    setIsFinished(false);
  };

  if (isFinished) {
    return (
      <Card className="w-full max-w-md mx-auto overflow-hidden border-none shadow-none">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">Practice Complete!</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <div className="mb-4 flex justify-center">
            {score === questions.length ? (
              <div className="bg-green-100 text-green-600 p-4 rounded-full">
                <CheckCircle2 className="w-12 h-12" />
              </div>
            ) : (
              <div className="bg-blue-100 text-blue-600 p-4 rounded-full">
                <Award className="w-12 h-12" />
              </div>
            )}
          </div>
          <p className="text-4xl font-black mb-2">{score} / {questions.length}</p>
          <p className="text-muted-foreground">
            {score === questions.length 
              ? "Perfect! You've mastered this session." 
              : "Good effort! Review the session to improve your score."}
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Try Again
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Finish
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto border-none shadow-none">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
             Practice Mode
          </span>
        </div>
        <CardTitle className="text-lg font-bold leading-tight">
          {currentQuestion.text}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pb-6">
        <RadioGroup 
          value={selectedChoiceId?.toString()} 
          onValueChange={(val) => !showFeedback && setSelectedChoiceId(parseInt(val))}
          className="gap-3"
        >
          {currentQuestion.choices.map((choice) => {
            const isSelected = selectedChoiceId === choice.id;
            const isCorrect = choice.is_correct;
            
            let statusClass = "border-border hover:border-primary/50";
            if (showFeedback) {
              if (isCorrect) statusClass = "border-green-500 bg-green-50/50 ring-1 ring-green-500";
              else if (isSelected) statusClass = "border-red-500 bg-red-50/50 ring-1 ring-red-500";
              else statusClass = "opacity-60 border-border";
            } else if (isSelected) {
              statusClass = "border-primary bg-primary/5 ring-1 ring-primary";
            }

            return (
              <div key={choice.id}>
                <Label
                  htmlFor={choice.id.toString()}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer",
                    statusClass,
                    !showFeedback && "hover:translate-x-1"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={choice.id.toString()} id={choice.id.toString()} className="sr-only" />
                    <span className="text-sm font-medium">{choice.text}</span>
                  </div>
                  {showFeedback && (
                    <>
                      {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                      {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                    </>
                  )}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>

      <CardFooter className="pt-2 flex justify-between items-center border-t border-border/40">
        <div className="text-sm font-medium text-muted-foreground">
          {showFeedback && (
            <span className={cn(
              "flex items-center gap-1.5",
              currentQuestion.choices.find(c => c.id === selectedChoiceId)?.is_correct ? "text-green-600" : "text-red-600"
            )}>
              {currentQuestion.choices.find(c => c.id === selectedChoiceId)?.is_correct 
                ? "Correct! Well done." 
                : "Not quite. See the correct answer above."}
            </span>
          )}
        </div>
        {!showFeedback ? (
          <Button onClick={handleSubmit} disabled={selectedChoiceId === null} className="px-8">
            Check Answer
          </Button>
        ) : (
          <Button onClick={handleNext} className="px-8">
            {currentIdx < questions.length - 1 ? "Next Question" : "Finish Practice"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

const Award = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
    <circle cx="12" cy="8" r="6" />
  </svg>
);
