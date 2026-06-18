<script setup lang="ts">
import { useReportStore } from '../../stores/report'

interface StyleProps {
  align?: 'left' | 'center' | 'right' | 'justify'
  bold?: boolean
  fontSize?: number
  fontFamily?: string
  lineSpacing?: number
  indent?: number
  color?: string
}

const store = useReportStore()
const props = defineProps<{ block: StyleProps; defaultAlign?: 'left' | 'center' | 'right' | 'justify' }>()
const emit = defineEmits<{ update: [data: Partial<StyleProps>] }>()

const s = () => store.activeDocument?.settings
const fontSize = () => props.block.fontSize ?? s()?.fontSize ?? 14
const lineSpacing = () => props.block.lineSpacing ?? s()?.lineSpacing ?? 1.5
const fontFamily = () => props.block.fontFamily ?? s()?.fontFamily ?? 'Times New Roman'
const indent = () => props.block.indent ?? s()?.paragraphIndent ?? 1.25
const color = () => '#' + (props.block.color ?? '000000')

function setColor(hex: string) {
  emit('update', { color: hex.replace('#', '').toUpperCase() })
}
</script>

<template>
  <div class="block-style-row">
    <!-- Align -->
    <div class="style-group">
      <button
        v-for="a in (['left','center','right','justify'] as const)"
        :key="a"
        :class="['style-btn', { active: (props.block.align ?? props.defaultAlign ?? 'justify') === a }]"
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

    <!-- Text color -->
    <input
      type="color"
      class="style-color"
      :value="color()"
      @input="setColor(($event.target as HTMLInputElement).value)"
      title="Колір тексту"
    />

    <!-- Reset to doc defaults -->
    <button
      class="style-btn"
      @click="emit('update', { fontSize: undefined, fontFamily: undefined, lineSpacing: undefined, indent: undefined, color: undefined })"
      title="Скинути до налаштувань документа"
    >↺</button>
  </div>
</template>
