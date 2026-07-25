import { describe, it, expect, vi } from 'vitest';
import { bindMuiRhfField } from '../muiRhfField';

describe('bindMuiRhfField', () => {
  it('forwards RHF ref through inputRef and shrinks label when value is set', () => {
    const rhfRef = vi.fn();
    const onInputRef = vi.fn();
    const fieldRegister = {
      name: 'username',
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ref: rhfRef,
    };

    const bound = bindMuiRhfField(fieldRegister, 'alice', { onInputRef });
    const input = document.createElement('input');
    bound.inputRef(input);

    expect(rhfRef).toHaveBeenCalledWith(input);
    expect(onInputRef).toHaveBeenCalledWith(input);
    expect(bound.InputLabelProps.shrink).toBe(true);
    expect(bound.name).toBe('username');
  });

  it('leaves shrink undefined when empty so MUI can manage focus state', () => {
    const bound = bindMuiRhfField(
      { name: 'email', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() },
      '',
    );
    expect(bound.InputLabelProps.shrink).toBeUndefined();
  });

  it('syncs mui-auto-fill animation into onChange', () => {
    const onChange = vi.fn();
    const bound = bindMuiRhfField(
      { name: 'email', onChange, onBlur: vi.fn(), ref: vi.fn() },
      '',
    );
    const event = { animationName: 'mui-auto-fill', target: { value: 'a@b.com' } };
    bound.inputProps.onAnimationStart(event);
    expect(onChange).toHaveBeenCalledWith(event);
  });
});
