import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import classNames from 'classnames';
import debounce from 'lodash.debounce';
import { Row } from './DicomTagBrowser';
import { Icons } from '@ohif/ui-next';

const lineHeightPx = 20;
const lineHeightClassName = `leading-[${lineHeightPx}px]`;
const rowVerticalPaddingPx = 10;
const rowBottomBorderPx = 1;
const rowVerticalPaddingStyle = { padding: `${rowVerticalPaddingPx}px 0` };
const rowStyle = {
  borderBottomWidth: `${rowBottomBorderPx}px`,
  ...rowVerticalPaddingStyle,
};
const indentationPadding = 8;

/**
 * Renders the text with every case-insensitive occurrence of the highlight value marked.
 */
function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight || !text) {
    return <>{text}</>;
  }

  const textLowerCase = text.toLowerCase();
  const highlightLowerCase = highlight.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let matchIndex = textLowerCase.indexOf(highlightLowerCase);

  while (matchIndex !== -1) {
    if (matchIndex > start) {
      parts.push(text.slice(start, matchIndex));
    }
    const end = matchIndex + highlight.length;
    parts.push(
      <mark
        key={matchIndex}
        className="bg-highlight/40 text-foreground rounded-sm"
      >
        {text.slice(matchIndex, end)}
      </mark>
    );
    start = end;
    matchIndex = textLowerCase.indexOf(highlightLowerCase, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return <>{parts}</>;
}

const RowComponent = ({
  row,
  style,
  keyPrefix,
  onToggle,
  highlightValue,
  isActive,
}: {
  row: Row;
  style: any;
  keyPrefix: string;
  onToggle?: (areChildrenVisible: boolean) => void;
  highlightValue?: string;
  isActive?: boolean;
}) => {
  const handleToggle = useCallback(() => {
    onToggle(!row.areChildrenVisible);
  }, [row.areChildrenVisible, onToggle]);

  const hasChildren = row.children && row.children.length > 0;
  const isChildOrParent = hasChildren || row.depth > 0;
  const padding = indentationPadding * (1 + 2 * row.depth);

  return (
    <div
      style={{ ...style, ...rowStyle }}
      className={classNames(
        'hover:bg-primary/25 border-input text-foreground flex w-full flex-row items-center break-all text-base',
        isActive ? 'bg-primary/30' : 'bg-background',
        lineHeightClassName
      )}
      data-cy={isActive ? 'dicom-tag-active-match' : undefined}
      key={keyPrefix}
    >
      {isChildOrParent && (
        <div style={{ paddingLeft: `${padding}px`, opacity: onToggle ? 1 : 0 }}>
          {row.areChildrenVisible ? (
            <div
              className="cursor-pointer p-1"
              onClick={handleToggle}
            >
              <Icons.ChevronDown />
            </div>
          ) : (
            <div
              className="cursor-pointer p-1"
              onClick={handleToggle}
            >
              <Icons.ChevronRight />
            </div>
          )}
        </div>
      )}
      <div className="w-4/24 px-3">
        <HighlightedText
          text={row.tag}
          highlight={highlightValue}
        />
      </div>
      <div className="w-2/24 px-3">
        <HighlightedText
          text={row.valueRepresentation}
          highlight={highlightValue}
        />
      </div>
      <div className="w-6/24 px-3">
        <HighlightedText
          text={row.keyword}
          highlight={highlightValue}
        />
      </div>
      <div className="w-5/24 grow px-3">
        <HighlightedText
          text={row.value}
          highlight={highlightValue}
        />
      </div>
    </div>
  );
};

function ColumnHeaders({ tagRef, vrRef, keywordRef, valueRef }) {
  return (
    <div
      className={classNames('bg-popover ohif-scrollbar flex w-full flex-row overflow-y-scroll')}
      style={rowVerticalPaddingStyle}
    >
      <div className="w-4/24 px-3">
        <label
          ref={tagRef}
          className="text-foreground flex flex-1 select-none flex-col pl-1 text-lg"
        >
          <span className="flex flex-row items-center focus:outline-none">Tag</span>
        </label>
      </div>
      <div className="w-2/24 px-3">
        <label
          ref={vrRef}
          className="text-foreground flex flex-1 select-none flex-col pl-1 text-lg"
        >
          <span className="flex flex-row items-center focus:outline-none">VR</span>
        </label>
      </div>
      <div className="w-6/24 px-3">
        <label
          ref={keywordRef}
          className="text-foreground flex flex-1 select-none flex-col pl-1 text-lg"
        >
          <span className="flex flex-row items-center focus:outline-none">Keyword</span>
        </label>
      </div>
      <div className="w-5/24 grow px-3">
        <label
          ref={valueRef}
          className="text-foreground flex flex-1 select-none flex-col pl-1 text-lg"
        >
          <span className="flex flex-row items-center focus:outline-none">Value</span>
        </label>
      </div>
    </div>
  );
}
function DicomTagTable({
  rows,
  highlightValue,
  activeRowUid,
}: {
  rows: Row[];
  highlightValue?: string;
  activeRowUid?: string;
}) {
  const listRef = useRef();
  const canvasRef = useRef();

  const [tagHeaderElem, setTagHeaderElem] = useState(null);
  const [vrHeaderElem, setVrHeaderElem] = useState(null);
  const [keywordHeaderElem, setKeywordHeaderElem] = useState(null);
  const [valueHeaderElem, setValueHeaderElem] = useState(null);
  const [internalRows, setInternalRows] = useState(rows);
  const [prevRows, setPrevRows] = useState(rows);
  const pendingScrollRowUidRef = useRef<string>(undefined);

  /**
   * Sync the internal rows during render (rather than in an effect) so that effects
   * below never observe internal rows that are stale relative to the rows prop.
   */
  if (rows !== prevRows) {
    setPrevRows(rows);
    setInternalRows(rows);
  }

  // Here the refs are inturn stored in state to trigger a render of the table.
  // This virtualized table does NOT render until the header is rendered because the header column widths are used to determine the row heights in the table.
  // Therefore whenever the refs change (in particular the first time the refs are set), we want to trigger a render of the table.
  const tagRef = elem => {
    if (elem) {
      setTagHeaderElem(elem);
    }
  };
  const vrRef = elem => {
    if (elem) {
      setVrHeaderElem(elem);
    }
  };
  const keywordRef = elem => {
    if (elem) {
      setKeywordHeaderElem(elem);
    }
  };
  const valueRef = elem => {
    if (elem) {
      setValueHeaderElem(elem);
    }
  };

  const visibleRows = useMemo(() => {
    return internalRows.filter(row => row.isVisible);
  }, [internalRows]);

  /**
   * When new rows are set, scroll to the top and reset the virtualization.
   */
  useEffect(() => {
    if (!listRef?.current) {
      return;
    }

    listRef.current.scrollTo(0);
    listRef.current.resetAfterIndex(0);
  }, [rows]);

  /**
   * When the browser window resizes, update the row virtualization (i.e. row heights)
   */
  useEffect(() => {
    const debouncedResize = debounce(() => listRef.current.resetAfterIndex(0), 100);

    window.addEventListener('resize', debouncedResize);

    return () => {
      debouncedResize.cancel();
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  const getOneRowHeight = useCallback(
    row => {
      const headerWidths = [
        tagHeaderElem.offsetWidth,
        vrHeaderElem.offsetWidth,
        keywordHeaderElem.offsetWidth,
        valueHeaderElem.offsetWidth,
      ];

      const context = canvasRef.current.getContext('2d');
      context.font = getComputedStyle(canvasRef.current).font;

      const propertiesToCheck = ['tag', 'valueRepresentation', 'keyword', 'value'];

      return Object.entries(row)
        .filter(([key]) => propertiesToCheck.includes(key))
        .map(([, colText], index) => {
          const colOneLineWidth = context.measureText(colText).width;
          const numLines = Math.ceil(colOneLineWidth / headerWidths[index]);
          return numLines * lineHeightPx + 2 * rowVerticalPaddingPx + rowBottomBorderPx;
        })
        .reduce((maxHeight, colHeight) => Math.max(maxHeight, colHeight), 0);
    },
    [keywordHeaderElem, tagHeaderElem, valueHeaderElem, vrHeaderElem]
  );

  /**
   * Get the item/row size. We use the header column widths to calculate the various row heights.
   * @param index the row index
   * @returns the row height
   */
  const getItemSize = useCallback(
    rows => index => {
      const row = rows[index];
      const height = getOneRowHeight(row);
      return height;
    },
    [getOneRowHeight]
  );

  useEffect(() => {
    pendingScrollRowUidRef.current = activeRowUid;
  }, [activeRowUid]);

  /**
   * Bring the active row into view: first expand any collapsed ancestor sequence/item,
   * then (once the expanded rows are rendered) scroll the row to the center of the list.
   */
  useEffect(() => {
    const uid = pendingScrollRowUidRef.current;
    if (!uid || !listRef?.current) {
      return;
    }

    const rowsByUid = new Map(internalRows.map(internalRow => [internalRow.uid, internalRow]));
    const activeRow = rowsByUid.get(uid);
    if (!activeRow) {
      return;
    }

    const collapsedAncestor = activeRow.parents
      ?.map(parentUid => rowsByUid.get(parentUid))
      .find(parentRow => parentRow && !parentRow.areChildrenVisible);

    if (collapsedAncestor) {
      setInternalRows(
        internalRows.map(internalRow => {
          if (internalRow.uid === collapsedAncestor.uid) {
            return { ...internalRow, areChildrenVisible: true };
          }
          if (collapsedAncestor.children.includes(internalRow.uid)) {
            return { ...internalRow, isVisible: true, areChildrenVisible: true };
          }
          return internalRow;
        })
      );
      return;
    }

    const index = visibleRows.findIndex(visibleRow => visibleRow.uid === uid);
    if (index === -1) {
      return;
    }

    pendingScrollRowUidRef.current = undefined;
    listRef.current.resetAfterIndex(0);
    listRef.current.scrollToItem(index, 'center');
  }, [activeRowUid, internalRows, visibleRows, tagHeaderElem]);

  const onToggle = useCallback(
    sourceRow => {
      if (!sourceRow.children) {
        return undefined;
      }

      return areChildrenVisible => {
        const newInternalRows = internalRows.map(internalRow => {
          if (sourceRow.uid === internalRow.uid) {
            return { ...internalRow, areChildrenVisible };
          }
          if (sourceRow.children.includes(internalRow.uid)) {
            return { ...internalRow, isVisible: areChildrenVisible, areChildrenVisible };
          }
          return internalRow;
        });
        setInternalRows(newInternalRows);

        listRef?.current?.resetAfterIndex(0);
      };
    },
    [internalRows, listRef]
  );

  const getRowComponent = useCallback(
    ({ rows }: { rows: Row[] }) =>
      function RowList({ index, style }) {
        const row = useMemo(() => rows[index], [index]);

        return (
          <RowComponent
            style={style}
            row={row}
            keyPrefix={`DICOMTagRow-${index}`}
            onToggle={onToggle(row)}
            highlightValue={highlightValue}
            isActive={!!activeRowUid && row.uid === activeRowUid}
          />
        );
      },
    [onToggle, highlightValue, activeRowUid]
  );

  /**
   * Whenever any one of the column headers is set, then the header is rendered.
   * Here we chose the tag header.
   */
  const isHeaderRendered = useCallback(() => tagHeaderElem !== null, [tagHeaderElem]);

  return (
    <div>
      <canvas
        style={{ visibility: 'hidden', position: 'absolute' }}
        className="text-base"
        ref={canvasRef}
      />
      <ColumnHeaders
        tagRef={tagRef}
        vrRef={vrRef}
        keywordRef={keywordRef}
        valueRef={valueRef}
      />
      <div
        className="border-background bg-background relative m-auto border-2"
        style={{ height: '32rem' }}
      >
        {isHeaderRendered() && (
          <List
            ref={listRef}
            height={500}
            itemCount={visibleRows.length}
            itemSize={getItemSize(visibleRows)}
            width={'100%'}
            className="ohif-scrollbar text-foreground"
          >
            {getRowComponent({ rows: visibleRows })}
          </List>
        )}
      </div>
    </div>
  );
}

export default React.memo(DicomTagTable);
