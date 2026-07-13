<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { bindInput, isWebMidiSupported, listInputs, listOutputs, requestMidiAccess, type MidiDeviceInfo } from '../../modules/midi/webMidi'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
const supported = isWebMidiSupported()
const inputs = ref<MidiDeviceInfo[]>([])
const outputs = ref<MidiDeviceInfo[]>([])
let access: Awaited<ReturnType<typeof requestMidiAccess>> = null

onMounted(async () => {
  if (!supported) return
  access = await requestMidiAccess()
  inputs.value = listInputs(access)
  outputs.value = listOutputs(access)
  bindInput(access, settings.midiInputId, () => {})
})

function selectInput(id: string) {
  settings.patchSettings({ midiInputId: id })
  bindInput(access, id, () => {})
}

function selectOutput(id: string) {
  settings.patchSettings({ midiOutputId: id })
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-page-title">
      <div>
        <h2>Music Devices</h2>
        <p>Thiết lập thiết bị MIDI đầu vào và đầu ra giống bảng Music Devices của Synthesia.</p>
      </div>
      <span class="settings-pill">{{ supported ? 'Web MIDI' : 'Unavailable' }}</span>
    </header>

    <SettingsSection title="Music Input" :description="supported ? 'Nhận nốt từ keyboard MIDI hoặc virtual piano.' : 'Trình duyệt hiện tại không hỗ trợ Web MIDI API.'">
      <SettingsRow title="Synthesia Virtual Piano" description="Fallback mặc định khi chưa chọn MIDI keyboard.">
        <span class="device-count">18 Keys</span>
      </SettingsRow>
      <SettingsRow title="MIDI Input" description="Thiết bị dùng để chơi nốt của bạn.">
        <select class="settings-control" :disabled="!supported" :value="settings.midiInputId" @change="selectInput(($event.target as HTMLSelectElement).value)">
          <option value="">Không chọn</option>
          <option v-for="device in inputs" :key="device.id" :value="device.id">{{ device.name }}</option>
        </select>
      </SettingsRow>
      <SettingsRow title="Auto-connect last input" description="Lưu lựa chọn ở store; tích hợp tự kết nối sẽ làm ở bước sau.">
        <SettingsToggle :model-value="settings.musicDevicesAutoConnectInput" @change="settings.patchSettings({ musicDevicesAutoConnectInput: $event })" />
      </SettingsRow>
    </SettingsSection>

    <SettingsSection title="Music Output">
      <SettingsRow title="Built-in MIDI Synthesizer" description="Ưu tiên synth phần mềm khi chưa chọn thiết bị output.">
        <SettingsToggle :model-value="settings.musicDevicesPreferBuiltInSynth" @change="settings.patchSettings({ musicDevicesPreferBuiltInSynth: $event })" />
      </SettingsRow>
      <SettingsRow title="MIDI Output" description="Thiết bị phát âm thanh MIDI bên ngoài.">
        <select class="settings-control" :disabled="!supported" :value="settings.midiOutputId" @change="selectOutput(($event.target as HTMLSelectElement).value)">
          <option value="">Built-in MIDI Synthesizer</option>
          <option v-for="device in outputs" :key="device.id" :value="device.id">{{ device.name }}</option>
        </select>
      </SettingsRow>
      <SettingsRow title="Auto-connect last output" description="Chỉ lưu cấu hình ở phase giao diện.">
        <SettingsToggle :model-value="settings.musicDevicesAutoConnectOutput" @change="settings.patchSettings({ musicDevicesAutoConnectOutput: $event })" />
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.device-count {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.78rem;
}
</style>
