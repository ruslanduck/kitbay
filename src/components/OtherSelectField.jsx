import { useEffect, useRef, useState } from 'react'
import SelectField from './SelectField'
import { OTHER, choiceOf, normalizeChoice, otherDetail } from '../lib/otherChoice'

// A fixed list plus "Other", with what the other IS typed in a field beside it
// — the shoot type and the call sheet's roles. Asked for in so many words: "just
// give an Other option and next to it enter what exactly the other is". The old
// "Other…" row typed INSIDE the menu and added the value to the list for
// everyone, so every one-off became a permanent option.
//
// What is stored is the typed detail ("Lookbook"), or "Other" when nothing is
// typed — see lib/otherChoice. `onChange` gets an event-like { target: { value }
// }, like SelectField, so a call site keeps its handler.
export default function OtherSelectField({
  value,
  onChange,
  options = [],
  placeholder,
  ariaLabel,
  detailPlaceholder = 'Which one?',
  detailAriaLabel,
  // The wrapper's classes, and the ones that REPLACE them while "Other" is
  // picked (a call-sheet row needs room for two fields then).
  className = '',
  otherClassName = '',
  // The two controls' own look — the caller's field classes.
  selectClassName,
  detailClassName,
}) {
  // Whether the "which one" field is showing. Held HERE rather than read off the
  // value: typing "PDP" into it would otherwise flip the choice to PDP mid-word
  // and take the field away. It settles when the field loses focus.
  const [isOther, setIsOther] = useState(() => choiceOf(value, options) === OTHER)
  const [draft, setDraft] = useState(() => otherDetail(value, options))
  const emitted = useRef(value)
  const detailRef = useRef(null)
  const focusDetail = useRef(false)

  // A value that arrives from OUTSIDE — the form opened on another job — resets
  // both; one this field just sent is already reflected.
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    setIsOther(choiceOf(value, options) === OTHER)
    setDraft(otherDetail(value, options))
    // `options` are fixed lists, so only the value is watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Picking Other puts the cursor where the answer goes.
  useEffect(() => {
    if (isOther && focusDetail.current) {
      focusDetail.current = false
      detailRef.current?.focus()
    }
  }, [isOther])

  const emit = (v) => {
    emitted.current = v
    onChange({ target: { value: v } })
  }

  function pick(v) {
    if (v === OTHER) {
      if (isOther) return
      focusDetail.current = true
      setIsOther(true)
      setDraft('')
      emit(OTHER)
      return
    }
    setIsOther(false)
    setDraft('')
    emit(v)
  }

  // A detail that names a fixed option IS that option ("pdp" is PDP), so the
  // list can't grow a twin by way of this field either.
  function settle() {
    const v = normalizeChoice(draft, options)
    if (choiceOf(v, options) !== OTHER) {
      setIsOther(false)
      setDraft('')
    } else setDraft(otherDetail(v, options))
    if (v !== emitted.current) emit(v)
  }

  return (
    // The Other layout REPLACES the plain one rather than adding to it: two
    // min-widths in one class list are settled by stylesheet order, not intent.
    <div className={['flex gap-2', isOther && otherClassName ? otherClassName : className].filter(Boolean).join(' ')}>
      <div className={isOther ? 'w-28 shrink-0' : 'min-w-0 flex-1'}>
        <SelectField
          value={isOther ? OTHER : choiceOf(value, options)}
          onChange={(e) => pick(e.target.value)}
          options={[...options, OTHER]}
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          className={selectClassName}
        />
      </div>
      {isOther && (
        <input
          ref={detailRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            emit(e.target.value.trim() || OTHER)
          }}
          onBlur={settle}
          placeholder={detailPlaceholder}
          aria-label={detailAriaLabel}
          className={['min-w-0 flex-1', detailClassName].filter(Boolean).join(' ')}
        />
      )}
    </div>
  )
}
