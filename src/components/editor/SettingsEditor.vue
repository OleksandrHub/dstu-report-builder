<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { computed } from 'vue'

const store = useReportStore()
const s = computed(() => store.activeDocument?.settings)

function update(field: string, value: string | number) {
  store.updateSettings({ [field]: value } as never)
}

const fontSizes = [10, 11, 12, 13, 14]
const fontFamilies = ['Times New Roman', 'Arial', 'Calibri', 'Georgia']
const lineSpacings = [1.0, 1.15, 1.5, 2.0]
</script>

<template>
  <div v-if="s" class="settings-editor">
    <h3 class="section-title">Налаштування документа</h3>

    <div class="field-group">
      <label>Шрифт</label>
      <select class="field-input" :value="s.fontFamily" @change="update('fontFamily', ($event.target as HTMLSelectElement).value)">
        <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
      </select>
    </div>

    <div class="field-group">
      <label>Розмір (pt)</label>
      <div class="btn-group">
        <button
          v-for="size in fontSizes"
          :key="size"
          :class="['size-btn', { active: s.fontSize === size }]"
          @click="update('fontSize', size)"
        >{{ size }}</button>
      </div>
    </div>

    <div class="field-group">
      <label>Міжрядковий інтервал</label>
      <div class="btn-group">
        <button
          v-for="sp in lineSpacings"
          :key="sp"
          :class="['size-btn', { active: s.lineSpacing === sp }]"
          @click="update('lineSpacing', sp)"
        >{{ sp }}</button>
      </div>
    </div>

    <div class="field-group">
      <label>Абзацний відступ (см)</label>
      <input
        class="field-input"
        style="width: 80px"
        type="number"
        step="0.25"
        min="0"
        max="3"
        :value="s.paragraphIndent"
        @input="update('paragraphIndent', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <h4 class="subsection-title">Поля сторінки (см)</h4>

    <div class="field-row-two">
      <div class="field-group">
        <label>Ліве</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginLeft" @input="update('marginLeft', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="field-group">
        <label>Праве</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginRight" @input="update('marginRight', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="field-group">
        <label>Верхнє</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginTop" @input="update('marginTop', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
      <div class="field-group">
        <label>Нижнє</label>
        <input class="field-input" type="number" step="0.5" min="0" :value="s.marginBottom" @input="update('marginBottom', parseFloat(($event.target as HTMLInputElement).value))" />
      </div>
    </div>

    <h4 class="subsection-title">Префікси підписів</h4>

    <div class="field-group">
      <label>Рисунки</label>
      <input class="field-input" :value="s.imagePrefix" @input="update('imagePrefix', ($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field-group">
      <label>Лістинги</label>
      <input class="field-input" :value="s.listingPrefix" @input="update('listingPrefix', ($event.target as HTMLInputElement).value)" />
    </div>
    <div class="field-group">
      <label>Таблиці</label>
      <input class="field-input" :value="s.tablePrefix" @input="update('tablePrefix', ($event.target as HTMLInputElement).value)" />
    </div>
  </div>
</template>
