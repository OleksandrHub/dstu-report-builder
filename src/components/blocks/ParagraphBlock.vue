<script setup lang="ts">
import type { ParagraphBlock } from '../../types/document'

const props = defineProps<{ block: ParagraphBlock }>()
const emit = defineEmits<{
  update: [data: Partial<ParagraphBlock>]
  remove: []
  moveUp: []
  moveDown: []
  addAfter: [type: string]
}>()
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
      rows="4"
      placeholder="Текст абзацу..."
    />
  </div>
</template>
