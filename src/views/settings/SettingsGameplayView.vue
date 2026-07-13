<script setup lang="ts">
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import type { KeyboardRangeMode } from '../../types/settings'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()

const keyboardRangeOptions: Array<{ value: KeyboardRangeMode; label: string }> = [
  { value: '18-keys', label: '18 keys' },
  { value: '25-keys', label: '25 keys' },
  { value: '88-keys', label: '88 keys' },
  { value: 'my-notes', label: 'My notes' },
  { value: 'my-keyboard', label: 'My keyboard' },
  { value: 'song-only', label: 'Song only' },
  { value: 'custom', label: 'Custom' },
]
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>Gameplay</h2>
        <p>Thiết lập hiển thị và hành vi luyện tập khi chơi nhạc.</p>
      </div>
    </header>

    <SettingsSection title="Play Controls">
      <SettingsRow title="Default speed" description="Tốc độ mặc định khi mở bài hát.">
        <input class="settings-control compact" type="number" min="0" max="400" step="10" :value="settings.defaultSpeed" @change="settings.setSpeed(Number(($event.target as HTMLInputElement).value))" />
        <span class="unit">%</span>
      </SettingsRow>
      <SettingsRow title="Show duration" description="Thời gian nốt rơi xuất hiện trước khi tới phím.">
        <input class="settings-control compact" type="number" min="0.25" max="10" step="0.25" :value="settings.showDuration" @change="settings.setShowDuration(Number(($event.target as HTMLInputElement).value))" />
        <span class="unit">s</span>
      </SettingsRow>
      <SettingsRow title="Input octave shift" description="Dịch octave cho input MIDI.">
        <input class="settings-control compact" type="number" min="-4" max="4" step="1" :value="settings.octaveShift" @change="settings.patchSettings({ octaveShift: Number(($event.target as HTMLInputElement).value) })" />
      </SettingsRow>
      <SettingsRow title="Keyboard range" description="Phạm vi phím hiển thị trong gameplay.">
        <select class="settings-control" :value="settings.keyboardRangeMode" @change="settings.setKeyboardRangeMode(($event.target as HTMLSelectElement).value as KeyboardRangeMode)">
          <option v-for="option in keyboardRangeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Display During Play">
      <SettingsRow title="Falling notes" description="Hiển thị note rơi.">
        <SettingsToggle :model-value="settings.showFallingNotes" @change="settings.patchSettings({ showFallingNotes: $event })" />
      </SettingsRow>
      <SettingsRow title="Falling measure lines" description="Hiển thị grid/measure lines.">
        <SettingsToggle :model-value="settings.showGrid" @change="settings.patchSettings({ showGrid: $event })" />
      </SettingsRow>
      <SettingsRow title="Sheet music" description="Hiển thị sheet music nếu có dữ liệu.">
        <SettingsToggle :model-value="settings.showSheetMusic" @change="settings.patchSettings({ showSheetMusic: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Metronome">
      <SettingsRow title="Volume" description="Âm lượng metronome.">
        <input class="settings-control compact" type="range" min="0" max="100" step="5" :value="settings.metronomeVolume" @input="settings.setMetronomeVolume(Number(($event.target as HTMLInputElement).value))" />
        <span class="unit">{{ settings.metronomeVolume }}%</span>
      </SettingsRow>
      <SettingsRow title="Double speed" description="Gõ metronome ở tốc độ gấp đôi.">
        <SettingsToggle :model-value="settings.metronomeDoubleSpeed" @change="settings.setMetronomeDoubleSpeed($event)" />
      </SettingsRow>
      <SettingsRow title="Emphasize first beat" description="Nhấn mạnh phách đầu tiên của ô nhịp.">
        <SettingsToggle :model-value="settings.metronomeEmphasizeFirstBeat" @change="settings.setMetronomeEmphasizeFirstBeat($event)" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.unit {
  min-width: 2.4rem;
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.78rem;
  text-align: right;
}
</style>
