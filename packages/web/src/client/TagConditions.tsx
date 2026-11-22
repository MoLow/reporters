import React, { useRef } from 'react';
import { TAG_OPERATORS, tagTokens } from './tagFilters.ts';

/** Display tokens rather than reinterpreting the runner's expression grammar. */
export function TagConditions({ filters }: { filters: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="run-tag-filter">
      <button type="button" className="btn" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        Tag conditions
      </button>
      <dialog
        ref={dialog}
        className="condition-modal"
        aria-label="Command tag conditions"
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      >
        <div className="pop-head">
          <div className="pop-heading">
            <div className="pop-title">Tag conditions</div>
            <div className="pop-path">Filters requested by the command</div>
          </div>
          <button type="button" className="pbtn pbtn-x" aria-label="Close tag conditions" onClick={() => dialog.current?.close()}>✕</button>
        </div>
        <div className="condition-body" role="region" aria-label="Command tag conditions" tabIndex={0}>
          <div className="condition-help">
            {filters.length === 1
              ? 'One --experimental-test-tag-filter value.'
              : `${filters.length} separate --experimental-test-tag-filter values, combined with AND. All must match.`}
            {' '}Within each value, NOT binds before AND, then OR.
          </div>
          {filters.map((filter, index) => (
            <React.Fragment key={index}>
              {index > 0 ? <div className="condition-join">AND</div> : null}
              <div className="condition-help">Flag value {index + 1}</div>
              <div className="condition-expression" aria-label={filter}>
                {tagTokens(filter).map((token, position) => {
                  const operator = TAG_OPERATORS.get(token.toLowerCase());
                  const kind = operator ? 'operator' : /^[()&|]$/.test(token) ? 'punctuation' : 'tag';
                  return (
                    <span key={position} className={`condition-${kind}`} data-operator={operator} title={token}>
                      {operator ?? token}
                    </span>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
          <details className="condition-source">
            <summary>Original expressions</summary>
            {filters.map((filter, index) => (
              <div key={index}>
                <div className="condition-help">Flag value {index + 1}</div>
                <pre>{filter}</pre>
              </div>
            ))}
          </details>
        </div>
      </dialog>
    </div>
  );
}
