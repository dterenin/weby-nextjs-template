"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const phrases = [
  "Загружаем компоненты...",
  "Проверяем соединение...",
  "Устанавливаем обновления...",
  "Настраиваем интерфейс...",
  "Подключаем сервисы...",
  "Применяем настройки...",
  "Загружаем ресурсы...",
  "Финальная настройка...",
  "Подготовка к запуску...",
  "Активируем функции...",
];

export default function LoadingPage() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);

  useEffect(() => {
    const phraseInterval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 3500);

    return () => clearInterval(phraseInterval);
  }, []);

  const getVisiblePhrases = () => {
    const result = [];
    for (let i = -2; i <= 2; i++) {
      const index = (currentPhraseIndex + i + phrases.length) % phrases.length;
      result.push({
        phrase: phrases[index],
        offset: i,
        key: `${index}-${currentPhraseIndex}`
      });
    }
    return result;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      {/* Header with Logo */}
      <div className="text-center mb-16">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Image
            src="https://pdlc-platform.vercel.app/logo.png"
            alt="Logo"
            width={60}
            height={60}
            className="filter grayscale"
          />
          <h1 className="text-6xl font-bold text-black tracking-wide">
            GigaStudio
          </h1>
        </div>
        <p className="text-xl text-gray-600">
          Подготовка вашего проекта...
        </p>
        <div className="flex justify-center space-x-2 mt-8">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-gray-400 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1.5s'
              }}
            />
          ))}
        </div>
      </div>

      {/* Spinning Drum */}
      <div className="relative flex items-center justify-center">
        {/* Background for Drum Area */}
        <div className="absolute inset-0 bg-gray-50 border-2 border-gray-200 rounded-2xl shadow-lg" />
        
        {/* Drum Container */}
        <div className="relative w-96 h-64 overflow-hidden p-6 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative">
              {getVisiblePhrases().map(({ phrase, offset, key }) => {
                const isCenter = offset === 0;
                const opacity = isCenter ? 1 : Math.abs(offset) === 1 ? 0.5 : 0.2;
                const scale = isCenter ? 1.1 : 1;
                const translateY = offset * 48;
                
                return (
                  <div
                    key={key}
                    className={`absolute flex items-center justify-center transition-all duration-1000 ease-out ${
                      isCenter
                        ? 'font-bold text-black'
                        : 'text-gray-500'
                    }`}
                    style={{
                      opacity,
                      transform: `translateY(${translateY}px) scale(${scale})`,
                      width: '320px',
                      height: '40px',
                      left: '50%',
                      top: '50%',
                      marginLeft: '-160px',
                      marginTop: '-20px'
                    }}
                  >
                    <span className="text-lg text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {phrase}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}