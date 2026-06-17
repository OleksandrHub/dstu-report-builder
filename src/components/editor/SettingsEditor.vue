<script setup lang="ts">
import { useReportStore } from '../../stores/report'
import { computed } from 'vue'

const store = useReportStore()
const s = computed(() => store.activeDocument?.settings)

function update(field: string, value: string | number) {
  store.updateSettings({ [field]: value } as never)
}

function updateHF(which: 'header' | 'footer', field: string, value: string | number) {
  const cur = s.value?.[which]
  if (!cur) return
  store.updateSettings({ [which]: { ...cur, [field]: value } } as never)
}

const fontSizes = [10, 11, 12, 13, 14]
const fontFamilies = ['Times New Roman', 'Arial', 'Calibri', 'Georgia']
const lineSpacings = [1.0, 1.15, 1.5, 2.0]

const hfModes = [
  { value: 'none', label: 'Немає' },
  { value: 'text', label: 'Текст' },
  { value: 'pageNumber', label: 'Номер сторінки' },
  { value: 'textAndPage', label: 'Текст + номер' },
] as const
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

    <h4 class="subsection-title">Верхній колонтитул</h4>
    <div class="field-group">
      <label>Вміст</label>
      <select class="field-input" :value="s.header.mode" @change="updateHF('header', 'mode', ($event.target as HTMLSelectElement).value)">
        <option v-for="m in hfModes" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
    <template v-if="s.header.mode !== 'none'">
      <div v-if="s.header.mode === 'text' || s.header.mode === 'textAndPage'" class="field-group">
        <label>Текст</label>
        <input class="field-input" :value="s.header.text" @input="updateHF('header', 'text', ($event.target as HTMLInputElement).value)" placeholder="Текст колонтитула" />
      </div>
      <div class="field-row-two">
        <div class="field-group">
          <label>Вирівнювання</label>
          <select class="field-input" :value="s.header.align" @change="updateHF('header', 'align', ($event.target as HTMLSelectElement).value)">
            <option value="left">Зліва</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>
        </div>
        <div class="field-group">
          <label>Шрифт</label>
          <select class="field-input" :value="s.header.fontFamily" @change="updateHF('header', 'fontFamily', ($event.target as HTMLSelectElement).value)">
            <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div class="field-group">
          <label>Розмір (pt)</label>
          <input class="field-input" type="number" min="8" max="20" step="1" :value="s.header.fontSize" @input="updateHF('header', 'fontSize', parseInt(($event.target as HTMLInputElement).value) || 12)" />
        </div>
      </div>
    </template>

    <h4 class="subsection-title">Нижній колонтитул</h4>
    <div class="field-group">
      <label>Вміст</label>
      <select class="field-input" :value="s.footer.mode" @change="updateHF('footer', 'mode', ($event.target as HTMLSelectElement).value)">
        <option v-for="m in hfModes" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>
    <template v-if="s.footer.mode !== 'none'">
      <div v-if="s.footer.mode === 'text' || s.footer.mode === 'textAndPage'" class="field-group">
        <label>Текст</label>
        <input class="field-input" :value="s.footer.text" @input="updateHF('footer', 'text', ($event.target as HTMLInputElement).value)" placeholder="Текст колонтитула" />
      </div>
      <div class="field-row-two">
        <div class="field-group">
          <label>Вирівнювання</label>
          <select class="field-input" :value="s.footer.align" @change="updateHF('footer', 'align', ($event.target as HTMLSelectElement).value)">
            <option value="left">Зліва</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
          </select>
        </div>
        <div class="field-group">
          <label>Шрифт</label>
          <select class="field-input" :value="s.footer.fontFamily" @change="updateHF('footer', 'fontFamily', ($event.target as HTMLSelectElement).value)">
            <option v-for="f in fontFamilies" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div class="field-group">
          <label>Розмір (pt)</label>
          <input class="field-input" type="number" min="8" max="20" step="1" :value="s.footer.fontSize" @input="updateHF('footer', 'fontSize', parseInt(($event.target as HTMLInputElement).value) || 12)" />
        </div>
      </div>
    </template>
  </div>
</template>
