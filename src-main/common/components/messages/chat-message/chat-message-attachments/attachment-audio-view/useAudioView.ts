/*
Copyright (C) 2025 3NSoft Inc.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see <http://www.gnu.org/licenses/>.
*/
import { inject, onMounted, shallowRef, ref, useTemplateRef, computed, onBeforeUnmount } from 'vue';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { NOTIFICATIONS_KEY, I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { transformWeb3nFileToFile } from '@v1nt1248/3nclient-lib/utils';
import type { AttachmentViewInfo } from '@main/common/components/messages/chat-message/chat-message-attachments/types';
import { timeInSecondsToString } from '@main/common/utils/chat-ui.helper';
import { getFileByInfoFromMsg } from '@main/common/utils/files.helper';

export function useAudioView({ item, incomingMsgId }: { item: AttachmentViewInfo; incomingMsgId?: string }) {
  const { $createNotice } = inject(NOTIFICATIONS_KEY)!;
  const { $tr } = inject(I18N_KEY)!;

  const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasEl');
  const ctx = ref<Nullable<CanvasRenderingContext2D>>(null);

  const audioContext = new AudioContext();
  const source = shallowRef<Nullable<MediaElementAudioSourceNode>>(null);
  const analyser = audioContext.createAnalyser();
  analyser.smoothingTimeConstant = 0.7;
  analyser.fftSize = 256;
  const frequencyData = shallowRef(new Uint8Array(analyser.frequencyBinCount));

  const audioPlayerRef = useTemplateRef<HTMLAudioElement>('audioEl');

  const isProcessing = ref(true);
  const isPlaying = ref(false);
  const duration = ref(0);
  const currentTime = ref(0);
  const volume = ref(50);

  const currentAudioVisualization = ref(1);

  const durationAsText = computed(() => timeInSecondsToString(duration.value));
  const currentTimeAsText = computed(() => timeInSecondsToString(currentTime.value));

  let requestAnimation: number;

  function onCanplaythrough() {
    isProcessing.value = false;
    duration.value = audioPlayerRef.value!.duration;
  }

  function onTimeupdate(event: Event) {
    currentTime.value = (event.target as HTMLAudioElement).currentTime;
  }

  function onEnded() {
    isPlaying.value = false;
    currentTime.value = 0;
    audioPlayerRef.value!.currentTime = 0;
  }

  function play() {
    requestAnimation = window.requestAnimationFrame(render);
    audioPlayerRef.value!.play();
    isPlaying.value = true;
  }

  function pause() {
    window.cancelAnimationFrame(requestAnimation);
    audioPlayerRef.value!.pause();
    isPlaying.value = false;
  }

  function updateVolume(val: number | [number, number]) {
    if (!Array.isArray(val)) {
      volume.value = val;
      audioPlayerRef.value!.volume = (val || 0) / 100;
    }
  }

  function updateCurrentTime(val: number | [number, number]) {
    if (!Array.isArray(val)) {
      currentTime.value = val;
      audioPlayerRef.value!.currentTime = val;
    }
  }

  /* audio visualization */

  function render() {
    switch (currentAudioVisualization.value) {
      case 1:
        render1();
        break;
      case 2:
        render2();
        break;
      default:
        console.error('Unknown audio visualization');
        break;
    }
  }

  /* variant 1 */
  const columnsGap = 1;

  function drawColumn(x: number, width: number, height: number) {
    const gradient = ctx.value!.createLinearGradient(
      0, canvasRef.value!.height - height / 2, 0, canvasRef.value!.height,
    );
    gradient.addColorStop(1, '#20639b');
    gradient.addColorStop(0.2, '#f6d55c');
    gradient.addColorStop(0, '#ed553b');
    ctx.value!.fillStyle = gradient;
    ctx.value!.fillRect(x, canvasRef.value!.height - height / 2, width, height);
  }

  function render1() {
    if (!canvasRef.value) {
      return;
    }

    const { width, height } = canvasRef.value;
    const frequencyDataSize = analyser.fftSize;

    analyser.getByteFrequencyData(frequencyData.value);
    ctx.value!.clearRect(0, 0, width, height);
    const columnWidth = (width * 1.0) / ( frequencyDataSize * 0.5);
    const heightScale = height / 100;

    let xPos = 0;
    for (const i of frequencyData.value) {
      const columnHeight = i * heightScale;
      drawColumn(xPos, columnWidth - columnsGap, columnHeight * 0.75);
      xPos += columnWidth;
    }

    requestAnimation = window.requestAnimationFrame(render);
  }

  /* variant 2 */
  function render2() {
    if (!canvasRef.value) {
      return;
    }

    const bufferLength = analyser.fftSize;
    const { width, height } = canvasRef.value;
    ctx.value!.clearRect(0, 0, width, height);

    function draw2() {
      requestAnimation = window.requestAnimationFrame(draw2);
      analyser.getByteTimeDomainData(frequencyData.value);

      ctx.value!.clearRect(0, 0, width, height);
      ctx.value!.lineWidth = 3;
      ctx.value!.strokeStyle = '#20639b';
      ctx.value!.beginPath();

      const sliceWidth = (width * 1.0) / (bufferLength * 0.5);
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = frequencyData.value[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.value!.moveTo(x, y);
        } else {
          ctx.value!.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.value!.lineTo(width, height / 2);
      ctx.value!.stroke();
    }

    draw2();
  }

  onMounted(() => {
    canvasRef.value!.width = canvasRef.value!.clientWidth;
    canvasRef.value!.height = canvasRef.value!.clientHeight;
    ctx.value = canvasRef.value!.getContext('2d');

    audioPlayerRef.value!.currentTime = 0;
    audioPlayerRef.value!.volume = volume.value / 100;

    audioPlayerRef.value!.addEventListener('canplaythrough', onCanplaythrough);
    audioPlayerRef.value!.addEventListener('timeupdate', onTimeupdate);
    audioPlayerRef.value!.addEventListener('ended', onEnded);

    source.value = audioContext.createMediaElementSource(audioPlayerRef.value!);
    source.value!.connect(analyser);
    analyser.connect(audioContext.destination);

    setTimeout(() => {
      getFileByInfoFromMsg(item.id!, incomingMsgId)
        .then(file3n => {
          if (!file3n) {
            isProcessing.value = false;
            $createNotice({
              type: 'error',
              content: $tr('chat.view.load.file.error'),
            });
            return;
          }

          return transformWeb3nFileToFile(file3n);
        })
        .then(val => {
          if (!val) {
            return;
          }

          const mediaData = URL.createObjectURL(val);
          audioPlayerRef.value && (audioPlayerRef.value.src = mediaData);
        });
    }, 100);
  });

  onBeforeUnmount(() => {
    audioPlayerRef.value!.removeEventListener('canplaythrough', onCanplaythrough);
    audioPlayerRef.value!.removeEventListener('timeupdate', onTimeupdate);
    audioPlayerRef.value!.removeEventListener('ended', onEnded);
  });

  return {
    isProcessing,
    isPlaying,
    canvasRef,
    audioPlayerRef,
    duration,
    durationAsText,
    volume,
    currentTime,
    currentTimeAsText,
    currentAudioVisualization,
    updateVolume,
    updateCurrentTime,
    play,
    pause,
  };
}
