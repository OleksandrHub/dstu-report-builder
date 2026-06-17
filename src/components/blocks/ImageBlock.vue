<script setup lang="ts">
import type { ImageBlock } from '../../types/document'
import { ref } from 'vue'

const props = defineProps<{ block: ImageBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<ImageBlock>]
  remove: []
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
        placeholder="Результат роботи програми наведено на рисунку"
      />
    </div>

    <div class="block-field-row">
      <label>Підпис:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва рисунка"
      />
    </div>

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
  </div>
</template>
