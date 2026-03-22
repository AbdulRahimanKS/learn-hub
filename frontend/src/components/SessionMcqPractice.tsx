import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface McqPracticeQuestion {
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
  questions: McqPracticeQuestion[];
  onClose: () => void;
}

function normalizeFillBlank(s: string) {
  return s.trim().toLowerCase();
}

/** Every non-empty choice marked correct is an acceptable answer (admin “Acceptable Correct Answers”). */
function acceptableFillBlankTexts(question: McqPracticeQuestion): string[] {
  return question.choices.filter(c => c.is_correct && c.text.trim()).map(c => c.text.trim());
}

function isFillBlankAnswerCorrect(question: McqPracticeQuestion, rawAnswer: string): boolean {
  const user = normalizeFillBlank(rawAnswer);
  if (!user) return false;
  return acceptableFillBlankTexts(question).some(a => normalizeFillBlank(a) === user);
}

export function SessionMcqPractice({ sessionTitle, questions, onClose }: SessionMcqPracticeProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [fillInBlankAnswer, setFillInBlankAnswer] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = questions[currentIdx];

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedChoiceId(null);
      setFillInBlankAnswer("");
      setShowFeedback(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleSubmit = () => {
    if (currentQuestion.is_fill_in_the_blank) {
      if (!fillInBlankAnswer.trim()) return;
      if (isFillBlankAnswerCorrect(currentQuestion, fillInBlankAnswer)) {
        setScore(prev => prev + 1);
      }
    } else {
      if (selectedChoiceId === null) return;
      const choice = currentQuestion.choices.find(c => c.id === selectedChoiceId);
      if (choice?.is_correct) {
        setScore(prev => prev + 1);
      }
    }
    setShowFeedback(true);
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setSelectedChoiceId(null);
    setFillInBlankAnswer("");
    setShowFeedback(false);
    setScore(0);
    setIsFinished(false);
  };

  if (isFinished) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className={cn(
            "p-4 rounded-full",
            score === questions.length ? "bg-emerald-500/20 text-emerald-500" : "bg-blue-500/20 text-blue-500"
          )}>
            {score === questions.length ? (
              <CheckCircle2 className="w-12 h-12" />
            ) : (
              <Award className="w-12 h-12" />
            )}
          </div>
        </div>
        <h2 className="mb-1 text-2xl font-bold text-foreground">Practice Complete!</h2>
        <p className="text-4xl font-black mb-4 text-primary">{score} / {questions.length}</p>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          {score === questions.length 
            ? "Excellent! You've successfully completed the practice with a perfect score." 
            : "Great effort! Keep practicing to master all concepts from this session."}
        </p>
        <div className="flex gap-4">
          <Button variant="outline" size="sm" className="h-10 flex-1" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Try Again
          </Button>
          <Button variant="gradient" size="sm" className="h-10 flex-1 rounded-xl font-bold shadow-none hover:shadow-none" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pt-2">
      {/* Question Header */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-muted-foreground">
          <span className="text-xs font-medium tracking-wide">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <div className="flex gap-1 h-0.5">
            {questions.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-6 rounded-full transition-all duration-300",
                  i === currentIdx ? "bg-primary h-1 mt-[-1px] w-8" : 
                  i < currentIdx ? "bg-primary/40" : "bg-border"
                )}
              />
            ))}
          </div>
        </div>
        <h3 className="text-lg font-bold leading-relaxed text-foreground md:text-xl">
          {currentQuestion.is_fill_in_the_blank 
            ? currentQuestion.text.split('[blank]').map((part, i, arr) => (
                <span key={i} className="inline">
                  {part}
                  {i < arr.length - 1 && (
                    <span className={cn(
                      "inline-block border-b-2 min-w-[30px] px-1 transition-colors mx-1",
                      showFeedback
                        ? isFillBlankAnswerCorrect(currentQuestion, fillInBlankAnswer)
                          ? 'border-emerald-500 text-emerald-400'
                          : 'border-red-500 text-red-400'
                        : 'border-primary/40 text-primary'
                    )}>
                      {fillInBlankAnswer || "\u00A0\u00A0\u00A0\u00A0"}
                    </span>
                  )}
                </span>
              ))
            : currentQuestion.text}
        </h3>
      </div>
      
      {/* Content Area */}
      <div className="min-h-[240px]">
        {currentQuestion.is_fill_in_the_blank ? (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-2">
              <Label className="ml-1 text-xs font-medium text-muted-foreground">Type your answer below</Label>
              <Input
                autoFocus
                value={fillInBlankAnswer}
                onChange={(e) => !showFeedback && setFillInBlankAnswer(e.target.value)}
                placeholder="Write the answer here..."
                className={cn(
                  'h-12 rounded-md border border-input bg-background text-base text-foreground focus-visible:border-primary/50 focus-visible:ring-primary/20',
                  showFeedback &&
                    (isFillBlankAnswerCorrect(currentQuestion, fillInBlankAnswer)
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-red-500/50 bg-red-500/10')
                )}
              />
            </div>
            {showFeedback && (() => {
              const acceptable = acceptableFillBlankTexts(currentQuestion);
              const correct = isFillBlankAnswerCorrect(currentQuestion, fillInBlankAnswer);
              const multiple = acceptable.length > 1;
              return (
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3',
                    correct
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500/20 bg-red-500/10 text-red-400'
                  )}
                >
                  {correct ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {correct
                        ? 'Correct!'
                        : multiple
                          ? 'Any one of these answers is correct:'
                          : 'The correct answer is:'}
                    </p>
                    {!correct && acceptable.length === 0 && (
                      <p className="mt-0.5 text-base font-medium">—</p>
                    )}
                    {!correct && acceptable.length === 1 && (
                      <p className="mt-0.5 text-base font-medium">{acceptable[0]}</p>
                    )}
                    {!correct && multiple && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-base font-medium marker:text-current">
                        {acceptable.map((a, i) => (
                          <li key={`${i}-${a}`}>{a}</li>
                        ))}
                      </ul>
                    )}
                    {correct && !multiple && acceptable.length === 1 && (
                      <p className="mt-0.5 text-base font-medium opacity-90">{acceptable[0]}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <RadioGroup 
            value={selectedChoiceId?.toString()} 
            onValueChange={(val) => !showFeedback && setSelectedChoiceId(parseInt(val))}
            className="grid gap-3"
          >
            {currentQuestion.choices.map((choice, index) => {
              const isSelected = selectedChoiceId === choice.id;
              const isCorrect = choice.is_correct;

              let statusClass =
                'border border-input bg-background hover:bg-muted/50 hover:border-input';
              if (showFeedback) {
                if (isCorrect) {
                  statusClass = 'border-2 border-emerald-500/70 bg-emerald-500/10';
                } else if (isSelected) {
                  statusClass = 'border-2 border-red-500/70 bg-red-500/10';
                } else {
                  /* Do not use opacity on the row — it fades borders away; mute content only */
                  statusClass =
                    'border border-input bg-muted/25 text-muted-foreground';
                }
              } else if (isSelected) {
                statusClass = 'border-2 border-primary bg-primary/10 ring-1 ring-primary/25';
              }

              return (
                <div key={choice.id} className="animate-in fade-in duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                  <Label
                    htmlFor={choice.id.toString()}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md p-3 transition-all',
                      showFeedback ? 'cursor-default' : '',
                      statusClass
                    )}
                  >
                    <RadioGroupItem
                      value={choice.id.toString()}
                      id={choice.id.toString()}
                      disabled={showFeedback}
                      className="shrink-0 border-border text-primary data-[state=checked]:border-primary"
                    />
                    <span className="min-w-0 flex-1 text-base font-medium text-inherit">{choice.text}</span>
                    {showFeedback && (
                      <div className="ml-auto shrink-0">
                        {isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                        {isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500" />}
                      </div>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button 
          variant="ghost" 
          onClick={handleNext}
          className="h-10 rounded-xl px-4 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {showFeedback ? "Continue" : "Skip"}
        </Button>

        {!showFeedback ? (
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={currentQuestion.is_fill_in_the_blank ? !fillInBlankAnswer.trim() : selectedChoiceId === null}
            className="h-10 rounded-xl px-8 text-sm font-bold shadow-none hover:shadow-none"
          >
            Check Answer
          </Button>
        ) : (
          <Button
            variant="gradient"
            onClick={handleNext}
            className="h-10 rounded-xl px-8 text-sm font-bold shadow-none hover:shadow-none"
          >
            {currentIdx < questions.length - 1 ? 'Next Question' : 'Finish Practice'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
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
