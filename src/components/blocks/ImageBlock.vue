<script setup lang="ts">
import type { ImageBlock } from '../../types/document'
import { ref } from 'vue'
import MarkerHint from './MarkerHint.vue'
import BlockStyleRow from './BlockStyleRow.vue'

const props = defineProps<{ block: ImageBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<ImageBlock>]
  remove: []
  duplicate: []
  moveUp: []
  moveDown: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    emit('update', { src: reader.result as string })
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="block image-block">
    <div class="block-toolbar">
      <span class="block-type-label">🖼 Рисунок {{ props.index }}</span>
      <div class="block-actions">
        <button @click="emit('duplicate')" title="Копіювати">⎘</button>
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>

    <label class="ref-toggle">
      <input
        type="checkbox"
        :checked="props.block.referenceText !== ''"
        @change="emit('update', { referenceText: ($event.target as HTMLInputElement).checked ? 'Результат роботи програми наведено на рисунку {no}.' : '' })"
      />
      <span>Показувати посилання в тексті</span>
    </label>
    <template v-if="props.block.referenceText !== ''">
      <div class="block-field-row">
        <label>Текст посилання:</label>
        <input
          class="block-input"
          :value="props.block.referenceText"
          @input="emit('update', { referenceText: ($event.target as HTMLInputElement).value })"
          placeholder="Результат роботи програми наведено на рисунку {no}."
        />
      </div>
      <p class="block-hint">{no} — підставиться номер рисунка</p>
      <label class="ref-toggle">
        <input
          type="checkbox"
          :checked="!!props.block.inlineReference"
          @change="emit('update', { inlineReference: ($event.target as HTMLInputElement).checked })"
        />
        <span>Продовжити попередній абзац (без нового рядка)</span>
      </label>
    </template>

    <div class="block-field-row">
      <label>Підпис:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва рисунка"
      />
    </div>
    <MarkerHint />

    <div class="image-upload-area" @click="fileInputRef?.click()">
      <img v-if="props.block.src" :src="props.block.src" class="image-preview" alt="preview" />
      <div v-else class="image-placeholder">
        <span>Клікни щоб завантажити зображення</span>
        <span class="image-hint">(PNG, JPG)</span>
      </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onFileChange"
    />

    <div class="block-style-row">
      <span class="style-label">Ширина:</span>
      <input type="number" min="50" max="900" step="10" class="style-number"
        :value="props.block.width ?? 400"
        @input="emit('update', { width: parseInt(($event.target as HTMLInputElement).value) || 400 })"
        title="Ширина (px)" />
      <span class="style-unit">px</span>
      <span class="style-label">Висота:</span>
      <input type="number" min="0" max="900" step="10" class="style-number"
        :value="props.block.height ?? ''"
        @input="emit('update', { height: parseInt(($event.target as HTMLInputElement).value) || undefined })"
        title="Висота (px), 0 = авто" />
      <span class="style-unit">px</span>
    </div>
    <label class="ref-toggle">
      <input type="checkbox" :checked="!!props.block.noTrailingSpace"
        @change="emit('update', { noTrailingSpace: ($event.target as HTMLInputElement).checked })" />
      <span>Без порожнього рядка знизу</span>
    </label>

    <p class="block-hint">Форматування підпису:</p>
    <BlockStyleRow :block="props.block" default-align="center" @update="emit('update', $event)" />
  </div>
</template>
