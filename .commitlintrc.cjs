module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: 'conventional-changelog-conventionalcommits',
  formatter: '@commitlint/format',
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'header-max-length': [2, 'always', 120],
    'header-trim': [
      2,
      'always',
      (header) => {
        const isValid = header.trim() === header;
        return [isValid, `header must not have leading or trailing whitespace`];
      },
    ],
    'header-case': [2, 'always', ['sentence-case', 'start-case', 'lower-case']],
    'subject-case': [
      2,
      'always',
      ['sentence-case', 'start-case', 'lower-case'],
    ],
    'scope-case': [2, 'always', 'lower-case'],
  },
  ignores: [(commit) => commit === ''],
  defaultIgnores: true,
  helpUrl:
    'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
  prompt: {
    settings: {},
    messages: {
      skip: ':skip',
      max: 'upper %d chars',
      min: '%d chars at least',
      emptyWarning: 'can not be empty',
      upperLimitWarning: 'over limit',
      lowerLimitWarning: 'below limit',
    },
    questions: {
      type: {
        description: "Select the type of change that you're committing:",
        enum: {
          feat: {
            description: 'A new feature',
            title: 'Features',
            emoji: '✨',
          },
          fix: { description: 'A bug fix', title: 'Bug Fixes', emoji: '🐛' },
          docs: {
            description: 'Documentation only changes',
            title: 'Documentation',
            emoji: '📚',
          },
          style: {
            description: 'Changes that do not affect the meaning of the code',
            title: 'Styles',
            emoji: '💎',
          },
          refactor: {
            description:
              'A code change that neither fixes a bug nor adds a feature',
            title: 'Refactoring',
            emoji: '📦',
          },
          perf: {
            description: 'A code change that improves performance',
            title: 'Performance',
            emoji: '🚀',
          },
          test: {
            description: 'Adding missing tests or correcting existing tests',
            title: 'Tests',
            emoji: '🚨',
          },
          build: {
            description: 'Changes to the build system or dependencies',
            title: 'Build',
            emoji: '🛠',
          },
          ci: {
            description: 'Changes to CI configuration files and scripts',
            title: 'CI',
            emoji: '⚙️',
          },
          chore: {
            description: "Other changes that don't modify src or test files",
            title: 'Chores',
            emoji: '♻️',
          },
          revert: {
            description: 'Reverts a previous commit',
            title: 'Reverts',
            emoji: '🗑',
          },
        },
      },
      scope: {
        description:
          'What is the scope of this change (e.g. component or file name)',
      },
      subject: {
        description: 'Write a short, imperative description of the change',
      },
      body: {
        description: 'Provide a longer description of the change',
      },
      isBreaking: {
        description: 'Are there any breaking changes?',
      },
      breakingBody: {
        description: 'A BREAKING CHANGE commit requires a body.',
      },
      breaking: {
        description: 'Describe the breaking changes',
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?',
      },
      issuesBody: {
        description: 'If issues are closed, the commit requires a body.',
      },
      issues: {
        description: 'Add issue references (e.g. "fix #123", "re #123")',
      },
    },
  },
};
