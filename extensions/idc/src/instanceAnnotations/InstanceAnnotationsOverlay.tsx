import React, { useEffect, useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ohif/ui-next';

import instanceAnnotationStore from './instanceAnnotationStore';
import type { InstanceAnnotation } from './extractInstanceAnnotations';

export interface InstanceAnnotationsConfig {
  /** Master switch for the feature. */
  enabled?: boolean;
  /** Maximum number of labels rendered before collapsing into a "+N" indicator. */
  maxLabels?: number;
  /** Whether to render the colored dot before each label. */
  showColor?: boolean;
  /** Palette used to assign a stable color per concept label. */
  colors?: string[];
}

const DEFAULT_CONFIG: Required<InstanceAnnotationsConfig> = {
  enabled: true,
  maxLabels: 10,
  showColor: true,
  colors: ['#5acce6', '#fcfa6b', '#7ee37e', '#f7a35c', '#e67ee6', '#ff7f7f'],
};

/** Deterministically maps a string to a color from the palette. */
function colorForKey(key: string, colors: string[]): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Picks a stable color for an annotation based on its coded value (so different
 * findings such as "Head" and "Neck" get different colors), falling back to the
 * value text and finally the concept label.
 */
function colorForAnnotation(annotation: InstanceAnnotation, colors: string[]): string {
  const key =
    (annotation.codeValue &&
      `${annotation.codingSchemeDesignator ?? ''}:${annotation.codeValue}`) ||
    annotation.value ||
    annotation.label;
  return colorForKey(key, colors);
}

function buildTooltip(annotation: InstanceAnnotation): string {
  const lines: string[] = [];
  if (annotation.codeValue || annotation.codingSchemeDesignator) {
    const scheme = annotation.codingSchemeDesignator ?? '';
    const code = annotation.codeValue ?? '';
    lines.push(`${annotation.value} (${scheme}${scheme && code ? ': ' : ''}${code})`);
  }
  annotation.modifiers?.forEach(modifier => {
    lines.push(`${modifier.label}: ${modifier.value}`);
  });
  if (annotation.trackingIdentifier) {
    lines.push(`Group: ${annotation.trackingIdentifier}`);
  }
  return lines.join('\n');
}

function AnnotationLabel({
  annotation,
  config,
}: {
  annotation: InstanceAnnotation;
  config: Required<InstanceAnnotationsConfig>;
}) {
  const tooltip = buildTooltip(annotation);
  const modifierSuffix = annotation.modifiers?.length
    ? ` (${annotation.modifiers.map(m => m.value).join(', ')})`
    : '';
  const color = config.showColor ? colorForAnnotation(annotation, config.colors) : undefined;

  const content = (
    <div className="overlay-item flex flex-row items-center">
      {config.showColor && (
        <span
          className="mr-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="mr-1 shrink-0 opacity-[0.70]">{annotation.label}:</span>
      <span
        className="shrink-0 font-bold"
        style={{ color }}
      >
        {annotation.value}
        {modifierSuffix}
      </span>
    </div>
  );

  if (!tooltip) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="pointer-events-auto">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <div className="whitespace-pre-line text-left">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Viewport overlay item that renders the instance level qualitative annotations
 * (TID 1500 / TID 1501) associated with the image currently shown in a viewport.
 *
 * It is registered as a `viewportOverlay.bottomRight` customization item and
 * receives the resolved overlay props (current `instance`, `imageSliceData`, ...).
 */
export default function InstanceAnnotationsOverlay(props): React.ReactNode {
  const { instance, imageSliceData, customization } = props ?? {};
  const sopInstanceUID = instance?.SOPInstanceUID;

  // Re-render when SR display sets are parsed after the overlay has mounted.
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return instanceAnnotationStore.subscribe(() => forceUpdate(value => value + 1));
  }, []);

  const config = useMemo<Required<InstanceAnnotationsConfig>>(
    () => ({ ...DEFAULT_CONFIG, ...(customization?.config ?? {}) }),
    [customization]
  );

  const annotations = useMemo(() => {
    if (!config.enabled || !sopInstanceUID) {
      return [];
    }
    const frameNumber =
      imageSliceData?.imageIndex !== undefined ? imageSliceData.imageIndex + 1 : undefined;
    return instanceAnnotationStore.getAnnotations(sopInstanceUID, frameNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, sopInstanceUID, imageSliceData?.imageIndex, imageSliceData?.numberOfSlices]);

  if (!annotations.length) {
    return null;
  }

  const visible = annotations.slice(0, config.maxLabels);
  const hiddenCount = annotations.length - visible.length;

  return (
    <div
      data-cy="instance-annotations-overlay"
      className="flex flex-col items-end"
    >
      {visible.map((annotation, index) => (
        <AnnotationLabel
          key={`${annotation.label}-${annotation.value}-${index}`}
          annotation={annotation}
          config={config}
        />
      ))}
      {hiddenCount > 0 && <div className="overlay-item opacity-[0.70]">+{hiddenCount} more</div>}
    </div>
  );
}
