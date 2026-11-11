import React from 'react';

import { StudyList, type StudyRow } from '@ohif/ui-next';
import { useSeriesFetch } from '../../hooks';

import { StudyListSettingsPopover } from './StudyListSettingsPopover';

type PreviewSeriesView = 'all' | 'thumbnails' | 'list';
const ALLOWED_PREVIEW_SERIES_VIEWS: ReadonlyArray<PreviewSeriesView> = [
  'all',
  'thumbnails',
  'list',
];

export function SidePanelPreview({
  dataSource,
  selected,
  servicesManager,
}: {
  dataSource: any;
  selected: StudyRow | null;
  servicesManager: AppTypes.ServicesManager;
}) {
  const { series, onThumbnailImageError } = useSeriesFetch({ dataSource, selected });
  const { customizationService } = servicesManager.services;
  const thumbnailRendering = dataSource?.getConfig?.()?.thumbnailRendering;
  const thumbnailRequestStrategy =
    dataSource?.getConfig?.()?.thumbnailRequestStrategy || 'bulkDataRetrieve';
  const forceListView =
    thumbnailRendering === 'wadors' ||
    thumbnailRendering === 'thumbnailDirect' ||
    thumbnailRequestStrategy === 'bulkDataRetrieve';

  const customizationSeriesView = customizationService.getCustomization(
    'workList.previewSeriesView'
  );
  const configuredSeriesView: PreviewSeriesView = ALLOWED_PREVIEW_SERIES_VIEWS.includes(
    customizationSeriesView as PreviewSeriesView
  )
    ? (customizationSeriesView as PreviewSeriesView)
    : 'all';
  const seriesView: PreviewSeriesView = forceListView ? 'list' : configuredSeriesView;

  /**
   * When the study query did not return ModalitiesInStudy, derive the
   * modalities from the fetched series so the workflow list can be filtered
   * for this study.
   */
  const study = React.useMemo(() => {
    if (!selected || String(selected.modalities ?? '').trim() || !series.length) {
      return selected;
    }
    const modalities = Array.from(
      new Set(series.map(s => String(s.modality || s.Modality || '').toUpperCase()).filter(Boolean))
    ).join('/');
    return modalities ? { ...selected, modalities } : selected;
  }, [selected, series]);

  const previewProps: PreviewContentProps = {
    study: study as StudyRow | null,
    series,
    seriesView,
    onThumbnailImageError,
  };

  const renderPreviewContent = customizationService.getCustomization('workList.renderPreviewContent');
  if (typeof renderPreviewContent === 'function') {
    return <>{(renderPreviewContent as RenderPreviewContent)(React, previewProps)}</>;
  }
  return <DefaultPreviewContent {...previewProps} />;
}

export type PreviewContentProps = {
  study: StudyRow | null;
  series: any[];
  seriesView: PreviewSeriesView;
  onThumbnailImageError: (seriesUID: string) => void;
};

export type RenderPreviewContent = (
  React: typeof import('react'),
  props: PreviewContentProps
) => React.ReactNode;

function DefaultPreviewContent({
  study,
  series,
  seriesView,
  onThumbnailImageError,
}: PreviewContentProps) {
  return (
    <StudyList.PreviewContainer>
      <StudyList.PreviewHeader>
        <StudyListSettingsPopover />
        <StudyList.ClosePreviewButton />
      </StudyList.PreviewHeader>
      <StudyList.PreviewContent
        study={study}
        series={series}
        seriesView={seriesView}
        onThumbnailImageError={onThumbnailImageError}
      />
    </StudyList.PreviewContainer>
  );
}
