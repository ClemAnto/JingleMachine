import { Component, OnDestroy, inject, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';

import { VoiceTriggerService } from '../../../core/voice-trigger.service';
import { UiButton } from '../../../ui/button/button';

/**
 * Trigger-phrase input with a built-in microphone test.
 *
 * Shared by the create and edit modals. "Prova" starts a test listening session
 * on the VoiceTriggerService (which suspends the main engine), streams the words
 * heard into a box, and shows a success check when the phrase is recognized. The
 * session is released on destroy — the modal content is destroyed when it closes.
 */
@Component({
  selector: 'app-trigger-phrase-field',
  imports: [FormsModule, NzIconModule, NzInputModule, UiButton],
  templateUrl: './trigger-phrase-field.html',
})
export class TriggerPhraseField implements OnDestroy {
  /** Two-way trigger phrase (empty = no trigger). */
  readonly phrase = model('');

  private readonly voice = inject(VoiceTriggerService);
  private readonly message = inject(NzMessageService);

  protected readonly testing = this.voice.testing;
  protected readonly transcript = this.voice.testTranscript;
  protected readonly matched = this.voice.testMatched;

  protected onPhraseChange(value: string) {
    this.phrase.set(value);
    if (this.testing()) this.voice.setTestPhrase(value);
  }

  protected async toggleTest() {
    if (this.testing()) {
      this.voice.stopTest();
      return;
    }
    try {
      await this.voice.startTest(this.phrase());
    } catch {
      this.message.error('Microfono non disponibile o permesso negato.');
    }
  }

  ngOnDestroy() {
    if (this.testing()) this.voice.stopTest();
  }
}
