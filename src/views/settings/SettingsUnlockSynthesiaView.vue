<script setup lang="ts">
import SettingsRow from '../../components/settings/ui/SettingsRow.vue'
import SettingsSection from '../../components/settings/ui/SettingsSection.vue'
import SettingsToggle from '../../components/settings/ui/SettingsToggle.vue'
import { useSettingsStore } from '../../stores/settingsStore'

const settings = useSettingsStore()
</script>

<template>
  <div class="settings-page unlock-page">
    <header class="settings-page-title">
      <div>
        <h2>Unlock Synthesia</h2>
        <p>Màn mô phỏng unlock theo ảnh Synthesia; chưa gọi server hay mở khóa thật.</p>
      </div>
      <span class="settings-pill">Demo</span>
    </header>

    <section class="unlock-info">
      <p>This free demo gives you a chance to test your keyboard connection and try a few songs.</p>
      <h3>Play the Included Songs</h3>
      <p>Synthesia includes more than 150 songs. Unlocking gives you access to all of them.</p>
      <h3>Import Any Song</h3>
      <p>Synthesia can play any MIDI song available across the Internet.</p>
      <h3>Create Your Own Songs</h3>
      <p>Record and save your own songs using the simple, built-in multi-track recorder.</p>
      <h3>Unlock Once, Use Forever</h3>
      <p>Unlocking is a one-time purchase that continues to work through future updates.</p>
    </section>

    <SettingsSection>
      <div class="visit-banner">
        <i class="fa-solid fa-globe" aria-hidden="true" />
        Visit the Synthesia website to buy now!
      </div>
      <SettingsRow title="Email" description="Chỉ lưu ở local settings trong phase này.">
        <input class="settings-control" type="email" :value="settings.unlockSynthesiaEmail" placeholder="you@example.com" @change="settings.patchSettings({ unlockSynthesiaEmail: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow title="Unlock key" description="Không validate hoặc gửi ra ngoài.">
        <input class="settings-control" :value="settings.unlockSynthesiaLicenseKey" placeholder="Type your unlock key here" @change="settings.patchSettings({ unlockSynthesiaLicenseKey: ($event.target as HTMLInputElement).value })" />
      </SettingsRow>
      <SettingsRow title="Remember this device" description="Lưu lựa chọn này trong settings store.">
        <SettingsToggle :model-value="settings.unlockSynthesiaRememberDevice" @change="settings.patchSettings({ unlockSynthesiaRememberDevice: $event })" />
      </SettingsRow>
      <SettingsRow title="Activation" description="Tích hợp unlock thật sẽ thực hiện sau.">
        <button class="settings-button primary" type="button" disabled>OK</button>
      </SettingsRow>
    </SettingsSection>
  </div>
</template>

<style scoped>
.unlock-page {
  width: min(100%, 34rem);
}

.unlock-info {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.4rem;
  background: #353535;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.78rem;
  line-height: 1.45;
}

.unlock-info h3,
.unlock-info p {
  margin: 0;
}

.unlock-info h3 {
  margin-top: 0.55rem;
  color: #d5d43b;
  font-size: 0.82rem;
  font-weight: 600;
}

.visit-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  margin: 1rem auto;
  width: min(23rem, calc(100% - 2rem));
  padding: 0.62rem 0.9rem;
  border-radius: 0.18rem;
  background: linear-gradient(#5aad58, #3f9542);
  color: #ffffff;
}
</style>
