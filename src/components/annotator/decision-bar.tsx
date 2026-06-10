"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import type { FixCategory, RowStatus } from "@/lib/sc04";
import { FIX_CATEGORIES, STATUS_LABELS } from "@/lib/sc04";

export interface FixDraft {
  cats: FixCategory[];
  memo: string;
}

const FIX_CATEGORY_EXAMPLES: Record<FixCategory, string[]> = {
  Aa: [
    "질문에서 현재 사용되지 않는 modality를 요구함(현재 vision, audio 사용 중).",
    "질문이 복수의 답을 요구함.",
    "영상 없이 질문만 보고 맞출 수 있음.",
    "질문 유형에서 필요한 능력을 질문에서 요구하지 못함, 혹은 너무 미약함.",
    "질문에서 두 개 이상의 질문 유형(능력)을 요구하고 이 둘을 분리할 수 없음.",
    "주관식에서 답변 형식을 정형화할 필요가 있어 질문에서 제한된 형태의 답변을 유도하도록 해야함.",
  ],
  Ab: [
    "질문의 전제가 영상 내용과 불일치함.",
    "질문이 인과, 의도, 목적, 심리 상태 등을 요구하지만 현재 영상 근거만으로는 안정적 판정이 어려움.",
    "질문이 요구하는 시간, 사건 범위가 현재 영상의 범위와 설계상 불일치함.",
    "질문에서 가리키는 지시 대상이 모호함.",
    "질문에서 가리키는 시점이 모호함.",
    "질문의 비교, 집계, 관계, 시작 등의 기준이 모호함.",
    "질문에서 의도한 판단 근거용 grounding 객체가 모호함.",
    "대명사 사용, 관계어나 목적어 생략 등 모호할 수 있는 표현을 사용함.",
    "질문 표현의 오탈자, 비문, 문법 문제로 의미 해석이 불안정함.",
    "질문에서 가리키는 지시 대상이 복수 존재함.",
    "질문이 지나치게 주관적이거나 해석 의존적이라 객관 판정이 어려움.",
    "질문에서 사용된 표현 및 단어에 섣불리 일반화하거나 임의로 가정한 부분이 존재함.",
    "질문에서 노이즈가 될 만한 너무 세부적인 정보 혹은 과한 설명을 언급함.",
  ],
  Ac: [
    "영상 해상도를 고려했을 때 근거를 관측할 수 없음.",
    "핵심 대상이 너무 작게 또는 너무 짧게 등장하여 안정적으로 판별하기 어려움.",
    "occlusion, motion blur, 초점 불량, 카메라 흔들림, 컷 편집 등으로 근거 판별이 어려움.",
    "영상 내의 근거를 기타 이유로 관측할 수 없음.",
    "근거가 화면 밖에 있거나 일부만 보여서 증거 자체가 불완전함.",
    "컷 편집 또는 장면 전환으로 사건의 시간적 연속성을 보장할 수 없음.",
  ],
  Ba: [
    "선택지에 정답이 없음.",
    "선택지에 정답이 복수 존재함.",
    "선택지 간 의미 중복 또는 동치 관계가 있음.",
    "질문에 대한 주관식 정답이 다의적이거나 표현 변이가 클 수 있어 이에 대응할 수 있도록 객관식 보기를 보다 포괄적이고 정형화된 표현으로 정리할 필요가 있음.",
  ],
  Bb: [
    "선택지의 범주, 추상도, 문법 형식이 불균형함.",
    "선택지의 의미가 여러 방향으로 해석될 수 있음.",
    "대명사 사용, 관계어나 목적어 생략 등 모호할 수 있는 표현을 사용함.",
    "오답 선택지가 지나치게 부자연스럽거나 영상 없이 제거(배제) 가능함.",
    "선택지 순서나 표현이 특정 답을 과도하게 암시함.",
  ],
  C: [
    "annotation된 질문 유형이 실제 필요한 능력과 다름.",
    "annotation된 정답이 실제 정답 번호와 다름.",
  ],
};

export function DecisionBar({
  status,
  fixDraft,
  onAccept,
  onOpenFix,
  onDel,
  onClear,
  onDraftChange,
  onSaveFix,
  onCancelFix,
}: {
  status: RowStatus;
  fixDraft: FixDraft | null;
  onAccept: () => void;
  onOpenFix: () => void;
  onDel: () => void;
  onClear: () => void;
  onDraftChange: (draft: FixDraft) => void;
  onSaveFix: () => void;
  onCancelFix: () => void;
}) {
  const toggleCat = (cat: FixCategory, checked: boolean) => {
    if (!fixDraft) return;
    const cats = checked
      ? [...fixDraft.cats, cat]
      : fixDraft.cats.filter((c) => c !== cat);
    onDraftChange({ ...fixDraft, cats });
  };

  return (
    <div className="flex flex-col gap-3 border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={status === "accept" ? "default" : "outline"}
          aria-pressed={status === "accept"}
          onClick={onAccept}
        >
          채택 (1)
        </Button>
        <Button
          variant={status === "fix" ? "default" : "outline"}
          aria-pressed={status === "fix"}
          onClick={onOpenFix}
        >
          수정 (2)
        </Button>
        <Button
          variant={status === "del" ? "destructive" : "outline"}
          aria-pressed={status === "del"}
          onClick={onDel}
        >
          폐기 (3)
        </Button>
        <span className="text-muted-foreground text-xs">
          현재: {STATUS_LABELS[status]}
        </span>
        {status !== "none" && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            검수 취소
          </Button>
        )}
      </div>
      {fixDraft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveFix();
          }}
          className="flex flex-col gap-2 border-t pt-3"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {FIX_CATEGORIES.map((cat) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox(labelable button)가 label 내부에 있음
              <label
                key={cat.value}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <Checkbox
                  checked={fixDraft.cats.includes(cat.value)}
                  onCheckedChange={(checked) =>
                    toggleCat(cat.value, checked === true)
                  }
                />
                <HoverCard>
                  <HoverCardTrigger
                    render={<span />}
                    delay={200}
                    tabIndex={0}
                    className="inline-flex items-center gap-2 outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                  >
                    <span className="w-5 font-medium font-mono">
                      {cat.value}
                    </span>
                    <span className="underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">
                      {cat.label}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="right"
                    align="start"
                    className="w-[min(30rem,calc(100vw-2rem))]"
                  >
                    <div className="space-y-2">
                      <div className="font-medium">
                        {cat.value}. {cat.label}
                      </div>
                      <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                        {FIX_CATEGORY_EXAMPLES[cat.value].map((example) => (
                          <li key={example}>{example}</li>
                        ))}
                      </ol>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </label>
            ))}
          </div>
          <Input
            value={fixDraft.memo}
            onChange={(e) =>
              onDraftChange({ ...fixDraft, memo: e.target.value })
            }
            placeholder="간단한 이유 (선택)"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={fixDraft.cats.length === 0}>
              저장 (Enter)
            </Button>
            <Button type="button" variant="ghost" onClick={onCancelFix}>
              닫기 (Esc)
            </Button>
            {fixDraft.cats.length === 0 && (
              <span className="text-muted-foreground text-xs">
                카테고리를 1개 이상 선택하세요
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
