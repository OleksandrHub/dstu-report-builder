<script setup lang="ts">
import type { CodeBlock } from '../../types/document'

const props = defineProps<{ block: CodeBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<CodeBlock>]
  remove: []
  moveUp: []
  moveDown: []
}>()

const languages = ['typescript', 'javascript', 'python', 'java', 'c', 'cpp', 'csharp', 'sql', 'bash', 'html', 'css']
</script>

<template>
  <div class="block code-block">
    <div class="block-toolbar">
      <span class="block-type-label">{ } Код (Лістинг {{ props.index }})</span>
      <div class="block-actions">
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>

    <div class="block-field-row">
      <label>Посилання в тексті:</label>
      <input
        class="block-input"
        :value="props.block.referenceText"
        @input="emit('update', { referenceText: ($event.target as HTMLInputElement).value })"
        placeholder="Код програми подано у лістингу {no}."
      />
    </div>
    <p class="block-hint">{no} — підставиться номер лістингу</p>

    <div class="block-field-row">
      <label>Підпис лістингу:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва лістингу"
      />
    </div>

    <div class="block-field-row">
      <label>Мова:</label>
      <select
        class="block-select"
        :value="props.block.language"
        @change="emit('update', { language: ($event.target as HTMLSelectElement).value })"
      >
        <option v-for="lang in languages" :key="lang" :value="lang">{{ lang }}</option>
      </select>
    </div>

    <div class="block-style-row">
      <span class="style-label">Розмір:</span>
      <input type="number" min="8" max="24" step="1" class="style-number"
        :value="props.block.fontSize ?? 12"
        @input="emit('update', { fontSize: parseInt(($event.target as HTMLInputElement).value) || 12 })"
        title="Розмір шрифту (pt)"
      />
      <span class="style-unit">pt</span>
      <span class="style-label">Інтервал:</span>
      <input type="number" min="1" max="3" step="0.5" class="style-number"
        :value="props.block.lineSpacing ?? 1.0"
        @input="emit('update', { lineSpacing: parseFloat(($event.target as HTMLInputElement).value) || 1.0 })"
        title="Міжрядковий інтервал"
      />
    </div>

    <textarea
      class="block-textarea code-textarea"
      :value="props.block.code"
      @input="emit('update', { code: ($event.target as HTMLTextAreaElement).value })"
      rows="10"
      spellcheck="false"
      placeholder="// Код програми..."
    />
  </div>
</template>
