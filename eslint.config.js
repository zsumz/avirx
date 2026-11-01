import rubric from 'eslint-config-rubric';

export default [
    ...rubric,
    {
        // Negative type fixtures deliberately discard expressions whose type is never.
        files: ['tests/types/**/*.ts'],
        rules: {
            '@typescript-eslint/no-meaningless-void-operator': 'off',
        },
    },
];
