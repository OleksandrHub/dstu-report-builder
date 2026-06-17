<script setup lang="ts">
import type { TableBlock } from '../../types/document'
import { useReportStore } from '../../stores/report'

const props = defineProps<{ block: TableBlock; index: number }>()
const emit = defineEmits<{
  update: [data: Partial<TableBlock>]
  remove: []
  moveUp: []
  moveDown: []
}>()

const store = useReportStore()

function updateHeader(colIdx: number, value: string) {
  const headers = [...props.block.headers]
  headers[colIdx] = value
  emit('update', { headers })
}

function updateCell(rowId: string, colIdx: number, value: string) {
  const rows = props.block.rows.map(r => {
    if (r.id !== rowId) return r
    const cells = r.cells.map((c, i) => i === colIdx ? { ...c, text: value } : c)
    return { ...r, cells }
  })
  emit('update', { rows })
}
</script>

<template>
  <div class="block table-block">
    <div class="block-toolbar">
      <span class="block-type-label">⊞ Таблиця {{ props.index }}</span>
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
        placeholder="наведено текст"
      />
    </div>

    <div class="block-field-row">
      <label>Підпис:</label>
      <input
        class="block-input"
        :value="props.block.caption"
        @input="emit('update', { caption: ($event.target as HTMLInputElement).value })"
        placeholder="Назва таблиці"
      />
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

    <div class="table-editor-wrap">
      <table class="editor-table">
        <thead>
          <tr>
            <th v-for="(header, ci) in props.block.headers" :key="ci" class="table-header-cell">
              <input
                class="table-cell-input"
                :value="header"
                @input="updateHeader(ci, ($event.target as HTMLInputElement).value)"
                placeholder="Заголовок"
              />
              <button
                class="btn-icon btn-danger col-remove-btn"
                @click="store.removeTableColumn(props.block.id, ci)"
                :disabled="props.block.headers.length <= 1"
                title="Видалити стовпець"
              >✕</button>
            </th>
            <th class="col-add-cell">
              <button class="btn-icon" @click="store.addTableColumn(props.block.id)" title="Додати стовпець">+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in props.block.rows" :key="row.id">
            <td v-for="(cell, ci) in row.cells" :key="ci">
              <input
                class="table-cell-input"
                :value="cell.text"
                @input="updateCell(row.id, ci, ($event.target as HTMLInputElement).value)"
                placeholder="..."
              />
            </td>
            <td class="row-action-cell">
              <button
                class="btn-icon btn-danger"
                @click="store.removeTableRow(props.block.id, row.id)"
                :disabled="props.block.rows.length <= 1"
                title="Видалити рядок"
              >✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="btn-add-item" @click="store.addTableRow(props.block.id)">
      + Додати рядок
    </button>
  </div>
</template>
