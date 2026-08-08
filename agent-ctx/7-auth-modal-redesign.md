---
Task ID: 7
Agent: auth-modal-redesign
Task: Redesign auth-modal.tsx for progressive disclosure UX

Work Log:
- Read existing 766-line auth-modal.tsx to understand all modes, state, handlers, and bilingual text
- Read auth-provider.tsx to understand login/signup/resetPassword interface signatures
- Read language-provider.tsx to understand isRtl usage pattern
- Read globals.css to understand design system tokens (--primary, --card, --border, --accent, etc.)
- Analyzed all 4 modes: signin, signup (3-step), forgot, reset-code
- Designed new component architecture with extracted helper components
- Implemented Spinner, LeadingIcon, StepProgress, Alert as reusable sub-components
- Extracted shared CSS constants (inputBase, inputWithLeadingIcon, btnPrimary, btnGhost, labelCls)
- Replaced tab-bar mode selector with text-link navigation (less visual noise)
- Reduced modal max-width from max-w-lg to max-w-md for focused feel
- Added bottom-sheet behavior on mobile (items-end, rounded-t-2xl) vs centered card on desktop
- Added body scroll lock via useEffect
- Added ARIA attributes (role="dialog", aria-modal, aria-label)
- Added focus management via dialogRef
- Simplified header: icon + title + subtitle, no full-width primary banner
- Sign-in: clean email+password, remember me checkbox, forgot password link, sign up link, trust badge
- Sign-up: preserved 3-step wizard (Step 1: email+password, Step 2: name+firm, Step 3: jurisdiction+bar+type+terms)
- Forgot: centered email icon, simple text explanation, email input, send button, back link
- Reset code: centered scale icon, code input (mono), new password with toggle, confirm button, resend link
- Used ltr:/rtl: Tailwind variants for consistent RTL/LTR icon positioning
- All bilingual text preserved (Arabic/English via isRtl)
- All auth calls preserved: login(), signup({data}, password), resetPassword()
- Verified zero TypeScript errors with `npx tsc --noEmit` (no auth-modal entries in error output)
- Verified zero ESLint errors with `bun run lint` (no auth-modal entries in error output)

Stage Summary:
- Auth modal redesigned from 766 to ~1100 lines (increase due to extracted helper components, shared CSS constants, improved accessibility, and body-scroll-lock effect)
- Sign-in is clean and focused with progressive disclosure — no tabs, only text links
- Sign-up uses 3-step wizard with visual progress dots
- Forgot/Reset are simple single-purpose views with back navigation
- Mobile-first responsive: bottom-sheet on mobile, centered card (max-w-md) on desktop
- All existing functionality preserved: login, signup, resetPassword, all validation, all modes
- RTL support throughout using ltr:/rtl: Tailwind variants
- Accessible: ARIA roles, labels, focus management, body scroll lock
