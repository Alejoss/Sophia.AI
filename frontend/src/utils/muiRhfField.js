/**
 * Adapt react-hook-form register() for MUI TextField.
 *
 * - Forwards the RHF ref via inputRef (MUI puts `ref` on FormControl, not <input>).
 * - Shrinks the floating label when the field has a value so it never overlaps
 *   typed / autofilled / setValue content while the input is unfocused.
 * - Syncs Chrome autofill into RHF via MUI's mui-auto-fill animation.
 */
export function bindMuiRhfField(fieldRegister, value, { onInputRef } = {}) {
  const { ref, onChange, onBlur, ...rest } = fieldRegister;

  return {
    ...rest,
    onChange,
    onBlur,
    inputRef: (el) => {
      ref(el);
      onInputRef?.(el);
    },
    inputProps: {
      onAnimationStart: (event) => {
        if (
          event.animationName === 'mui-auto-fill' ||
          event.animationName === 'mui-auto-fill-cancel'
        ) {
          onChange?.(event);
        }
      },
    },
    InputLabelProps: {
      shrink: Boolean(value) || undefined,
    },
  };
}
