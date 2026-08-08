// =============================================================================
// Al Mizan — Seed built-in Document Templates
// =============================================================================
// Run: npx ts-node scripts/document-templates/seed-templates.ts
// Or:  bun run scripts/document-templates/seed-templates.ts
//
// Seeds the DocumentTemplate table with built-in legal document templates
// (Arabic + English) for the Jordanian legal system.
// =============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = process.env.SEED_ORG_ID || 'org_seed_placeholder';

const templates = [
  // ── English: Statement of Claim ──────────────────────────────────────────
  {
    name: 'Statement of Claim',
    nameAr: 'بيان الدعوى',
    type: 'statement_of_claim',
    category: 'litigation',
    language: 'en',
    description: 'Standard statement of claim for civil/commercial cases in Jordanian courts.',
    descriptionAr: 'بيان دعوى معياري للقضايا المدنية/التجارية في المحاكم الأردنية.',
    content: `IN THE {{courtName}} ({{courtCode}})

BETWEEN:

{{claimantName}}
Claimant

- and -

{{respondentName}}
Respondent

STATEMENT OF CLAIM

1. The Claimant, {{claimantName}}, hereby files this Statement of Claim against the Respondent, {{respondentName}}, seeking the relief set out below.

2. The Claimant and Respondent entered into an agreement dated {{agreementDate}} (the "Agreement").

3. The Respondent breached the terms of the Agreement on or about {{breachDate}}, by failing to comply with {{respondentObligation}}.

4. As a direct result of the Respondent's breach, the Claimant has suffered damages in the amount of {{damagesAmount}}.

RELIEF SOUGHT

The Claimant respectfully requests that this Honorable Court:

(a) Declare that the Respondent breached the Agreement;
(b) Award damages in the amount of {{damagesAmount}};
(c) Award costs and attorney's fees; and
(d) Grant such further relief as the Court deems just and proper.

Dated: {{currentDate}}

___________________________
{{claimantName}}
Claimant`,
    isBuiltIn: true,
  },

  // ── Arabic: بيان الدعوى ─────────────────────────────────────────────────
  {
    name: 'بيان الدعوى (عربي)',
    nameAr: 'بيان الدعوى',
    type: 'statement_of_claim',
    category: 'litigation',
    language: 'ar',
    description: 'بيان دعوى معياري للقضايا المدنية/التجارية في المحاكم الأردنية.',
    descriptionAr: 'بيان دعوى معياري للقضايا المدنية/التجارية في المحاكم الأردنية.',
    content: `في {{courtName}} ({{courtCode}})

بين:

{{claimantName}}
المدعي

— و —

{{respondentName}}
المدعى عليه

بيان الدعوى

1. المدعي، {{claimantName}}، يقدم بموجب هذا بيان الدعوى ضد المدعى عليه، {{respondentName}}، طالباً الطلبات المذكورة أدناه.

2. المدعي والمدعى عليه أبرما اتفاقية بتاريخ {{agreementDate}} ("الاتفاقية").

3. المدعى عليه أخلّ بشروط الاتفاقية في أو حوالي تاريخ {{breachDate}}، بعدم الالتزام بـ {{respondentObligation}}.

4. نتيجة مباشرة لإخلال المدعى عليه، تعرّض المدعي لأضرار بمبلغ {{damagesAmount}}.

الطلبات المطلوبة

يطلب المدعي باحترام من هذه المحكمة الموقرة:

(أ) الإعلان بأن المدعى عليه أخلّ بالاتفاقية؛
(ب) الحكم بالتعويضات بمبلغ {{damagesAmount}}؛
(ج) الحكم بالمصروفات وأتعاب المحاماة؛ و
(د) منح أي إغاثة أخرى تراها المحكمة عادلة ومناسبة.

التاريخ: {{currentDate}}

___________________________
{{claimantName}}
المدعي`,
    isBuiltIn: true,
  },

  // ── English: Statement of Defense ────────────────────────────────────────
  {
    name: 'Statement of Defense',
    nameAr: 'بيان الدفاع',
    type: 'statement_of_defense',
    category: 'litigation',
    language: 'en',
    description: 'Standard statement of defense responding to a claim in Jordanian courts.',
    descriptionAr: 'بيان دفاع معياري رداً على دعوى في المحاكم الأردنية.',
    content: `IN THE {{courtName}} ({{courtCode}})

BETWEEN:

{{claimantName}}
Claimant

- and -

{{respondentName}}
Respondent

STATEMENT OF DEFENSE

1. The Respondent, {{respondentName}}, files this Statement of Defense in response to the Claimant's Statement of Claim dated {{filingDate}}.

2. The Respondent denies the allegations set forth in paragraphs 1 through 4 of the Statement of Claim.

3. {{defenseParagraph1}}

4. {{defenseParagraph2}}

5. {{defenseParagraph3}}

WHEREFORE the Respondent respectfully requests that this Honorable Court dismiss the Claimant's claim in its entirety, with costs.

Dated: {{currentDate}}

___________________________
{{respondentName}}
Respondent`,
    isBuiltIn: true,
  },

  // ── English: Legal Notice ────────────────────────────────────────────────
  {
    name: 'Legal Notice',
    nameAr: 'إشعار قانوني',
    type: 'legal_notice',
    category: 'general',
    language: 'en',
    description: 'Formal legal notice / demand letter preceding litigation.',
    descriptionAr: 'إشعار قانوني رسمي / خطاب مطالبة قبل التقاضي.',
    content: `LEGAL NOTICE

Date: {{currentDate}}

To: {{recipientName}}
Address: {{recipientAddress}}

RE: {{subjectLine}}

{{noticeBody}}

You are hereby notified that unless the above-stated matter is resolved within {{responseDeadline}} days of receipt of this notice, we shall proceed to take all necessary legal action to protect our client's rights, including but not limited to filing a claim before the competent court.

This notice is given without prejudice to any additional rights or remedies available to our client.

Sincerely,

___________________________
{{claimantName}}
Per: Al Mizan Legal Practice`,
    isBuiltIn: true,
  },

  // ── English: Motion for Summary Judgment ─────────────────────────────────
  {
    name: 'Motion for Summary Judgment',
    nameAr: 'طلب حكم موجز',
    type: 'motion_summary_judgment',
    category: 'litigation',
    language: 'en',
    description: 'Motion for summary judgment when no material facts are in dispute.',
    descriptionAr: 'طلب حكم موجز عندما لا يكون هناك نزاع جوهري على الوقائع.',
    content: `IN THE {{courtName}} ({{courtCode}})

BETWEEN:

{{claimantName}}
Claimant/Applicant

- and -

{{respondentName}}
Respondent

MOTION FOR SUMMARY JUDGMENT

TO THE HONORABLE COURT:

The Claimant, {{claimantName}}, respectfully moves this Court for an order granting summary judgment in favor of the Claimant on the grounds that:

1. {{motionGround1}};

2. {{motionGround2}};

3. There is no genuine issue of material fact requiring a trial; and

4. The Claimant is entitled to judgment as a matter of law based on {{legalBasis}}.

WHEREFORE the Claimant respectfully requests that this Honorable Court grant summary judgment in favor of the Claimant, award damages of {{damagesAmount}}, and grant such further relief as the Court deems just.

Dated: {{currentDate}}

___________________________
{{claimantName}}
Claimant`,
    isBuiltIn: true,
  },
];

async function main() {
  console.log('Seeding DocumentTemplate table...');

  for (const tpl of templates) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { organizationId: ORG_ID, type: tpl.type, language: tpl.language, isBuiltIn: true },
    });

    if (existing) {
      console.log(`  ↳ Updating existing: ${tpl.name} (${tpl.type}/${tpl.language})`);
      await prisma.documentTemplate.update({
        where: { id: existing.id },
        data: {
          name: tpl.name,
          nameAr: tpl.nameAr,
          content: tpl.content,
          description: tpl.description,
          descriptionAr: tpl.descriptionAr,
          category: tpl.category,
          version: { increment: 1 },
        },
      });
    } else {
      console.log(`  ↳ Creating: ${tpl.name} (${tpl.type}/${tpl.language})`);
      await prisma.documentTemplate.create({
        data: {
          organizationId: ORG_ID,
          name: tpl.name,
          nameAr: tpl.nameAr,
          type: tpl.type,
          category: tpl.category,
          language: tpl.language,
          description: tpl.description,
          descriptionAr: tpl.descriptionAr,
          content: tpl.content,
          isBuiltIn: tpl.isBuiltIn,
        },
      });
    }
  }

  console.log('Done. Seeded', templates.length, 'templates.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
