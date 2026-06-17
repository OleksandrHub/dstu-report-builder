<script setup lang="ts">
import type { ListBlock, ListItem } from '../../types/document'
import { useReportStore } from '../../stores/report'

const props = defineProps<{ block: ListBlock }>()
const emit = defineEmits<{
  update: [data: Partial<ListBlock>]
  remove: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()
</script>

<template>
  <div class="block list-block">
    <div class="block-toolbar">
      <span class="block-type-label">≡ Список</span>
      <div class="list-type-toggle">
        <button
          :class="['level-btn', { active: !props.block.ordered }]"
          @click="emit('update', { ordered: false })"
        >• Марков.</button>
        <button
          :class="['level-btn', { active: props.block.ordered }]"
          @click="emit('update', { ordered: true })"
        >1. Нумер.</button>
      </div>
      <div class="block-actions">
        <button @click="emit('moveUp')" title="Вгору">↑</button>
        <button @click="emit('moveDown')" title="Вниз">↓</button>
        <button @click="emit('remove')" class="btn-danger" title="Видалити">✕</button>
      </div>
    </div>

    <input
      class="block-input"
      :value="props.block.introText"
      @input="emit('update', { introText: ($event.target as HTMLInputElement).value })"
      placeholder="Вступний текст (необов'язково): "
    />

    <div class="list-items">
      <div
        v-for="(item, idx) in props.block.items"
        :key="item.id"
        class="list-item-row"
      >
        <span class="list-marker">{{ props.block.ordered ? `${idx + 1}.` : '–' }}</span>
        <input
          class="block-input list-item-input"
          :value="item.text"
          @input="store.updateListItem(props.block.id, item.id, ($event.target as HTMLInputElement).value)"
          :placeholder="props.block.ordered ? 'Елемент списку...' : 'елемент списку...'"
        />
        <button
          class="btn-icon btn-danger"
          @click="store.removeListItem(props.block.id, item.id)"
          :disabled="props.block.items.length <= 1"
        >✕</button>
      </div>
    </div>

    <button class="btn-add-item" @click="store.addListItem(props.block.id)">
      + Додати елемент
    </button>
  </div>
</template>
