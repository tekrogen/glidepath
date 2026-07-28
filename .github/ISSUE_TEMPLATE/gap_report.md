---
name: Spec / design gap
about: The product is not broken, but the spec, mockup, or wireframe doesn't say what should happen
title: ""
labels: type:gap
assignees: ""
---

<!--
A gap is not a defect. The code may be doing exactly what it was told —
the problem is that nothing authoritative says what it *should* do.

Before submitting, add: phase:N and severity:*.
-->

## What is undefined

Describe the situation the product hits where no artifact tells it what to do.

## Where the silence is

Tick every artifact you checked and found silent or contradictory. The normative order runs top to bottom — a lower artifact never overrides a higher one.

- [ ] `CLAUDE.md` Rules
- [ ] An EDR in the Production Blueprint
- [ ] The Production Blueprint body
- [ ] Architecture README (`admin/internal/features-planning/architecture/README.md`)
- [ ] Hi-Fi mockup (layout / composition / navigation truth)
- [ ] Wireframes 0a–2d (functional truth where the Hi-Fi is silent)
- [ ] Reviews / donor codebases / the tracker (advisory only)

## Conflict?

If two artifacts disagree, quote both and name their positions in the normative order. A genuine conflict becomes a **proposed EDR**, not an ad-hoc judgment call.

- Higher artifact says:
- Lower artifact says:

## Gap Register

- Existing entry, if any (G#):
- Proposed priority: Critical (phase blocker) / Important / Nice-to-have
- Proposed owner phase:

## Interim rule

What should the product do *until* this is decided? Every Gap Register row carries one.

## Proposed resolution

What should the authoritative answer be, and which artifact should carry it?

---

### Maintainer checklist

- [ ] Gap Register row added or updated in the blueprint
- [ ] Interim rule recorded
- [ ] Owner phase assigned
- [ ] EDR opened if this needed a decision rather than a clarification
