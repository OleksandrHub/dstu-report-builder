<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import type { ParagraphBlock } from '../../types/document'
import MarkerHint from './MarkerHint.vue'

const store = useReportStore()
const props = defineProps<{ block: ParagraphBlock }>()
const emit = defineEmits<{
  update: [data: Partial<ParagraphBlock>]
  remove: []
  moveUp: []
  moveDown: []
}>()

const doc = () => store.activeDocument
const fontSize = () => props.block.fontSize ?? doc()?.settings.fontSize ?? 14
const lineSpacing = () => props.block.lineSpacing ?? doc()?.settings.lineSpacing ?? 1.5
const fontFamily = () => props.block.fontFamily ?? doc()?.settings.fontFamily ?? 'Times New Roman'
const indent = () => props.block.indent ?? doc()?.settings.paragraphIndent ?? 1.25
</script>

<template>
  <div class="block paragraph-block">
    <div class="block-toolbar">
      <span class="block-type-label">¶ Абзац</span>
      <div class="block-actions">
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>

    <textarea
      class="block-textarea"
      :value="props.block.text"
      @input="emit('update', { text: ($event.target as HTMLTextAreaElement).value })"
      rows="3"
      placeholder="Текст абзацу..."
    />
    <MarkerHint />

    <div class="block-style-row">
      <!-- Align -->
      <div class="style-group">
        <button
          v-for="a in (['left','center','right','justify'] as const)"
          :key="a"
          :class="['style-btn', { active: (props.block.align ?? 'justify') === a }]"
          @click="emit('update', { align: a })"
          :title="a"
        >{{ a === 'left' ? '⇤' : a === 'center' ? '⇔' : a === 'right' ? '⇥' : '≡' }}</button>
      </div>

      <!-- Bold -->
      <button
        :class="['style-btn', { active: props.block.bold }]"
        @click="emit('update', { bold: !props.block.bold })"
        title="Жирний"
      ><b>B</b></button>

      <!-- Font family -->
      <select
        class="style-select"
        :value="fontFamily()"
        @change="emit('update', { fontFamily: ($event.target as HTMLSelectElement).value || undefined })"
        title="Шрифт"
      >
        <option value="">авто</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Arial">Arial</option>
        <option value="Calibri">Calibri</option>
      </select>

      <!-- Font size -->
      <input
        type="number" min="8" max="36" step="1"
        class="style-number"
        :value="fontSize()"
        @input="emit('update', { fontSize: parseInt(($event.target as HTMLInputElement).value) || undefined })"
        title="Розмір шрифту (pt)"
      />
      <span class="style-unit">pt</span>

      <!-- Line spacing -->
      <input
        type="number" min="1" max="3" step="0.5"
        class="style-number"
        :value="lineSpacing()"
        @input="emit('update', { lineSpacing: parseFloat(($event.target as HTMLInputElement).value) || undefined })"
        title="Міжрядковий інтервал"
      />
      <span class="style-unit">інт</span>

      <!-- First-line indent -->
      <input
        type="number" min="0" max="5" step="0.25"
        class="style-number"
        :value="indent()"
        @input="emit('update', { indent: parseFloat(($event.target as HTMLInputElement).value) })"
        title="Абзацний відступ (см)"
      />
      <span class="style-unit">см</span>

      <!-- Reset to doc defaults -->
      <button
        class="style-btn"
        @click="emit('update', { fontSize: undefined, fontFamily: undefined, lineSpacing: undefined, indent: undefined })"
        title="Скинути до налаштувань документа"
      >↺</button>
    </div>
  </div>
</template>
