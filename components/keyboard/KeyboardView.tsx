// KeyboardView.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  Animated,
  Easing,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
// Assume this JSON exists and exports an object of probabilities like:
// { "A": { "B": 0.7, "C": 0.3, ... }, "B": { "A": 0.5, ... }, ... }
// KEEPING THE IMPORT AS IS, per user request.
import hitboxProbabilitiesRaw from '@/data/hitboxProbabilities.json';
import Logger from '@/components/logger/Logger';

// --- Probability Table Construction (Unchanged) ---
function constructProbabilityTable(hitboxProbabilitiesRaw: any) {
  const table: Record<string, Record<string, number>> = {};
  return hitboxProbabilitiesRaw;
}
const hitboxProbabilities = constructProbabilityTable(hitboxProbabilitiesRaw);
// --- End Probability Table Construction ---

export interface KeyboardViewProps {
  message: string;
  setMessage: (text: string) => void;
  dynamicHitboxEnabled: boolean;
  setDynamicHitboxEnabled: (value: boolean) => void;
  hitboxAffected: boolean;
  setHitboxAffected: (value: boolean) => void;
  onToggleNumberSymbol: () => void;
  onSend: () => void;
  onBack: () => void;
  logger?: Logger | null;
}

// Define the keyboard layout - ONLY LETTER ROWS for dynamic hit detection
const keyLayout: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

// Constants
const BASE_SCALE = 1.0;
const SCALE_MULTIPLIER = 0.6; // Used for probability calculation influence, not visual scale now
const DEFAULT_PROBABILITY = 0.5;
const DEBUG_HITBOXES = false; // Keep false for production - now only controls debug overlay

// Helper function to get probability (Unchanged)
const getProbability = (prevKey: string, targetKey: string): number => {
  prevKey = prevKey.toLowerCase();
  targetKey = targetKey.toLowerCase();
  
  if (!/^[a-z]$/.test(prevKey) || !/^[a-z]$/.test(targetKey)) {
    return DEFAULT_PROBABILITY;
  }
  const probabilitiesForPrev = hitboxProbabilities[prevKey];
  if (probabilitiesForPrev && typeof probabilitiesForPrev[targetKey] === 'number') {
    return probabilitiesForPrev[targetKey];
  }
  return DEFAULT_PROBABILITY;
};

export default function KeyboardView(props: KeyboardViewProps) {
  const {
    message,
    setMessage,
    dynamicHitboxEnabled,
    setHitboxAffected,
    onToggleNumberSymbol,
    onSend,
    onBack,
    logger
  } = props;

  // State for keyboard dimensions and key positions (only for the letter grid)
  const [gridWidth, setGridWidth] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  interface KeyPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    letter: string;
    row: number;
    col: number;
  }
  const [keyPositions, setKeyPositions] = useState<KeyPosition[]>([]);

  // State for visual feedback and tracking (Unchanged)
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const lastLetterPressed = useRef<string | null>(null);

  // Refs for animations (Still used by updateKeyScales, though not visually applied)
  const animatedScalesRef = useRef<{ [key: string]: Animated.Value }>({});
  const currentScalesRef = useRef<{ [key: string]: number }>({});

  // Initialize animated scales for letter keys (Unchanged)
  // Although not visually used, the values might be useful for debugging or future features
  const initializeAnimatedScales = () => {
    const allKeys: string[] = keyLayout.flat();
    allKeys.forEach((letter) => {
        const kp = keyPositions.find(p => p.letter === letter);
        const keyId = kp ? `${kp.row}-${kp.col}-${letter}` : letter;
        if (!animatedScalesRef.current[keyId]) {
            animatedScalesRef.current[keyId] = new Animated.Value(BASE_SCALE);
            currentScalesRef.current[keyId] = BASE_SCALE;
        } else {
            animatedScalesRef.current[keyId].setValue(BASE_SCALE);
            currentScalesRef.current[keyId] = BASE_SCALE;
        }
    });
  };

  // Calculate key positions for the LETTER GRID when it lays out (Unchanged)
  const onGridLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width === 0 || height === 0) return;

    setGridWidth(width);
    setGridHeight(height);

    const computedPositions: KeyPosition[] = [];
    const rowCount = keyLayout.length;
    const rowHeight = height / rowCount;

    keyLayout.forEach((row, rowIndex) => {
      const colCount = row.length;
      const keyWidth = width / colCount;
      let currentX = 0;

      row.forEach((letter, colIndex) => {
        computedPositions.push({
          x: currentX,
          y: rowIndex * rowHeight,
          width: keyWidth,
          height: rowHeight,
          letter,
          row: rowIndex,
          col: colIndex,
        });
        currentX += keyWidth;
      });
    });
    setKeyPositions(computedPositions);

    initializeAnimatedScales();
    if (lastLetterPressed.current && dynamicHitboxEnabled) {
      updateKeyScales(lastLetterPressed.current, computedPositions);
    }
  };

  const onResponderRelease = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    if (keyPositions.length === 0) return;
  
    const candidates: { keyPos: KeyPosition; distance: number; score: number; touchInside: boolean }[] = [];
    let closestDistance = Infinity;
    // Define a threshold below which a touch is considered "centered".
    const CENTER_TOUCH_THRESHOLD = 0.15; // Adjust (in normalized units) as needed
  
    keyPositions.forEach((kp) => {
      const centerX = kp.x + kp.width / 2;
      const centerY = kp.y + kp.height / 2;
      const dx = locationX - centerX;
      const dy = locationY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      closestDistance = Math.min(closestDistance, distance);

      const touchInside = (
        locationX >= kp.x &&
        locationX <= kp.x + kp.width &&
        locationY >= kp.y &&
        locationY <= kp.y + kp.height
      );
  
      // Normalize the distance relative to the average key dimension.
      const avgKeyDimension = (kp.width + kp.height) / 2;
      const normalizedDistance = distance / avgKeyDimension;
      const distancePenalty = -Math.exp(normalizedDistance);

  
      let score = 0;
      if (dynamicHitboxEnabled) {
        if (lastLetterPressed.current) {
          const probability = getProbability(lastLetterPressed.current, kp.letter);
          let distanceMultiplier = Math.exp(
            -Math.pow(normalizedDistance, 2) / 0.25
          )
          score = probability * distanceMultiplier;
        } else {
          score = distancePenalty;
        }
      } else {
        score = distancePenalty;
      }
  
      candidates.push({ keyPos: kp, distance, score, touchInside });
    });
  
    // If the overall closest touch is too far from any key center, do nothing.
    const MAX_DISTANCE_THRESHOLD_FACTOR = 0.5;
    const maxDistanceThreshold = Math.min(gridWidth, gridHeight) * MAX_DISTANCE_THRESHOLD_FACTOR;
    if (closestDistance > maxDistanceThreshold) {
      return;
    }
  
    if (candidates.length === 0) return;
  
    // Sort so that the candidate with the highest (or infinite) score is chosen.
    candidates.sort((a, b) => b.score - a.score);
  
    let probabilityDidChangeOutcome = false;
    if (candidates.length > 1 && dynamicHitboxEnabled && lastLetterPressed.current) {
      const candidatesByDistance = [...candidates].sort((a, b) => a.distance - b.distance);
      if (candidates[0].keyPos.letter !== candidatesByDistance[0].keyPos.letter) {
        const touchedCandidate = candidates.find(c => c.touchInside);
        if (!touchedCandidate || touchedCandidate.keyPos.letter !== candidates[0].keyPos.letter) {
          probabilityDidChangeOutcome = true;
          if (logger) {
            logger.log(`changed_outcome`, { currentInput: message, changedFrom: candidatesByDistance[0].keyPos.letter, changedTo: candidates[0].keyPos.letter});
          } else {
            console.log(`Changed outcome from ${candidatesByDistance[0].keyPos.letter} to ${candidates[0].keyPos.letter} (current input: ${message})`);
          }
        }
      }
    }

    setHitboxAffected(probabilityDidChangeOutcome);
    
    if (logger) {
      logger.log(`Typed ${candidates[0].keyPos.letter}`, { currentInput: message });
    } else {
      console.log(`Typed ${candidates[0].keyPos.letter} (current input: ${message})`);
    }
    
    handleKeyPress(candidates[0].keyPos);
  };

  // --- Key Scaling Logic (Unchanged, calculates values but not visually applied) ---
  const updateKeyScales = (pressedLetter: string, currentKeyPositions: KeyPosition[]) => {
     if (!currentKeyPositions || currentKeyPositions.length === 0 || !/^[a-z]$/.test(pressedLetter)) {
        Object.keys(animatedScalesRef.current).forEach(keyId => {
             const letter = keyId.split('-').pop();
             if (letter && /^[a-z]$/.test(letter.toLowerCase())) {
                if (currentScalesRef.current[keyId] !== BASE_SCALE) {
                    // Stop any ongoing animation and set value directly
                    animatedScalesRef.current[keyId]?.stopAnimation();
                    animatedScalesRef.current[keyId]?.setValue(BASE_SCALE);
                    currentScalesRef.current[keyId] = BASE_SCALE;
                }
             }
        });
        setHitboxAffected(false);
        return;
     }

    // No animations needed, but update currentScaleRef and hitboxAffected state
    let anyScaleChangedDueToProbability = false;
    currentKeyPositions.forEach((kp) => {
      const keyId = `${kp.row}-${kp.col}-${kp.letter}`;
      let targetScale = BASE_SCALE;

      if (dynamicHitboxEnabled) {
        const p = getProbability(pressedLetter, kp.letter);
        targetScale = BASE_SCALE + (p - DEFAULT_PROBABILITY) * SCALE_MULTIPLIER;
        if (Math.abs(targetScale - BASE_SCALE) > 0.01) {
          anyScaleChangedDueToProbability = true;
        }
      }

      // Update the ref value directly, no animation needed
      if (animatedScalesRef.current[keyId]) {
          animatedScalesRef.current[keyId].setValue(targetScale); // Set value without animation
      } else {
           animatedScalesRef.current[keyId] = new Animated.Value(targetScale);
      }
       currentScalesRef.current[keyId] = targetScale; // Keep track of logical scale

    });

    // No Animated.parallel needed
    setHitboxAffected(anyScaleChangedDueToProbability);
  };

  // Handle key press action (Unchanged)
  const handleKeyPress = (kp: KeyPosition) => {
    const { letter } = kp;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setPressedKey(letter);
    setTimeout(() => {
      setPressedKey(null);
    }, 100);

    setMessage(message + letter);
    if (dynamicHitboxEnabled) {
      updateKeyScales(letter, keyPositions);
    }
    lastLetterPressed.current = letter;
  };

  // Handle backspace (Unchanged)
  const handleBackspace = () => {
    if (message.length > 0) {
        if (logger) {
          logger.log(`Backspace pressed`, { currentInput: message });
        } else {
          console.log(`Backspace pressed (current input: ${message})`);
        }
        
        const newMessage = message.slice(0, -1);
        setMessage(newMessage);
        if (newMessage.length > 0) {
            const lastChar = newMessage[newMessage.length-1].toLowerCase();
            if (/^[a-z]$/.test(lastChar)) {
                lastLetterPressed.current = lastChar;
                 if (dynamicHitboxEnabled) {
                    updateKeyScales(lastChar, keyPositions);
                 } else {
                    updateKeyScales('', keyPositions);
                 }
            } else {
                lastLetterPressed.current = null;
                updateKeyScales('', keyPositions);
            }
        } else {
            lastLetterPressed.current = null;
            updateKeyScales('', keyPositions);
        }
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Handlers for bottom row buttons (Unchanged)
  const handleSpacePress = () => {
    setMessage(message + ' ');
    lastLetterPressed.current = null;
    updateKeyScales('', keyPositions);
     if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleToggleNumberSymbolPress = () => {
    onToggleNumberSymbol();
    lastLetterPressed.current = null;
    updateKeyScales('', keyPositions);
     if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const [cursorVisible, setCursorVisible] = useState(true);
  const inputScrollViewRef = useRef<ScrollView>(null);

  // Effect for blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  // Effect to scroll to end when text changes
  useEffect(() => {
    if (inputScrollViewRef.current) {
      setTimeout(() => {
        inputScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [message]);

  // --- Render Logic ---
  return (
    <View style={styles.container}>
      {/* Top Buttons (Unchanged) */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={onBack}>
          <Text style={styles.actionButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onSend}>
          <Text style={styles.actionButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Input Row (Modified for horizontal scrolling and cursor) */}
      <View style={styles.inputRow}>
        <View style={styles.inputContainer}>
          <ScrollView
            ref={inputScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.inputScrollContent}
          >
            <Text style={styles.inputText}>
              {message}
              <Text style={[styles.cursor, { opacity: cursorVisible ? 1 : 0 }]}>|</Text>
            </Text>
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.backspaceButton} onPress={handleBackspace}>
          <Text style={styles.backspaceText}>⌫</Text>
        </TouchableOpacity>
      </View>

      {/* Keyboard Area (Unchanged structure) */}
      <View style={styles.keyboardArea}>
        {/* Letter Grid Container */}
        <View style={styles.gridContainer} onLayout={onGridLayout}>
          {keyPositions.length > 0 && (
            <>
              {/* Visible Letter Keys Layer */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {keyPositions.map((kp) => {
                  const keyId = `${kp.row}-${kp.col}-${kp.letter}`;
                  const isPressed = kp.letter === pressedKey;
                  // --- REMOVED scaleAnim usage ---
                  // const scaleAnim = animatedScalesRef.current[keyId] || new Animated.Value(BASE_SCALE);

                  return (
                    // Use regular View instead of Animated.View if no other animations are planned
                    <View
                      key={keyId}
                      style={[
                        styles.key,
                        {
                          left: kp.x,
                          top: kp.y,
                          width: kp.width,
                          height: kp.height,
                          backgroundColor: isPressed ? '#ccc' : '#fff',
                        },
                        // --- REMOVED TRANSFORM STYLE ---
                        // { transform: [{ scale: scaleAnim }] },
                        isPressed && { zIndex: 10 }, // Keep zIndex for pressed feedback
                      ]}
                    >
                      <Text style={styles.keyText}>{kp.letter}</Text>

                      {/* Debug probability text (Still useful) */}
                      {dynamicHitboxEnabled && DEBUG_HITBOXES && lastLetterPressed.current && (
                        <Text style={styles.probabilityText}>
                          {getProbability(lastLetterPressed.current, kp.letter).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Invisible Hitbox Layer (Unchanged) */}
              <View
                style={StyleSheet.absoluteFill}
                onStartShouldSetResponder={() => true}
                onResponderRelease={onResponderRelease}
              >
                {/* Debug influence areas (Still controlled by DEBUG_HITBOXES) */}
                {dynamicHitboxEnabled && DEBUG_HITBOXES && keyPositions.map((kp) => {
                   const keyId = `${kp.row}-${kp.col}-${kp.letter}`;
                   // Use currentScalesRef for debug visualization radius if needed
                   const logicalScale = currentScalesRef.current[keyId] || BASE_SCALE;
                   const radius = (Math.min(kp.width, kp.height) / 2) * logicalScale * 1.2; // Radius based on logical scale
                   let probability = DEFAULT_PROBABILITY;
                   if (lastLetterPressed.current) {
                       probability = getProbability(lastLetterPressed.current, kp.letter);
                   }
                   const hue = probability > DEFAULT_PROBABILITY ? 0 : 240;
                   const saturation = Math.abs(probability - DEFAULT_PROBABILITY) * 200;
                   const alpha = Math.abs(probability - DEFAULT_PROBABILITY) * 0.5 + 0.1;
                   return (
                     <View
                       key={`influence-${keyId}`}
                       style={[ styles.influenceArea, {
                           left: kp.x + kp.width / 2 - radius,
                           top: kp.y + kp.height / 2 - radius,
                           width: radius * 2, height: radius * 2,
                           borderRadius: radius,
                           backgroundColor: `hsla(${hue}, ${saturation}%, 50%, ${alpha})`,
                         }]}
                     />
                   );
                })}
              </View>
            </>
          )}
        </View>

        {/* Bottom Row Container (Unchanged) */}
        <View style={styles.bottomRowContainer}>
            <TouchableOpacity style={[styles.bottomButton, styles.spaceButton]} onPress={handleSpacePress}>
                <Text style={styles.bottomButtonText}>Space</Text>
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// --- Styles (Unchanged) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5', // Slightly different background
  },
  buttonsContainer: { // Top action buttons
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 5,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  inputRow: { // Input text + backspace
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 10,
  },
  inputContainer: {
    height: 45,
    borderWidth: 1,
    borderColor: '#d1d5db', // Slightly darker border
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    flex: 1,
  },
  inputScrollContent: {
    flexGrow: (1),
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 45,
  },
  inputText: {
    fontSize: 18,
    color: '#1f2937', // Darker text
    lineHeight: 45, // Match the container height for vertical centering
  },
  cursor: {
    fontSize: 18,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  backspaceButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backspaceText: {
    fontSize: 24, // Larger backspace icon
    color: '#6b7280', // Gray color
  },
  keyboardArea: { // Container for grid + bottom row
      flex: 1, // Takes remaining vertical space
      marginHorizontal: 3, // Narrower horizontal margin
      marginBottom: Platform.OS === 'ios' ? 10 : 5, // Bottom margin
  },
  gridContainer: { // Container for the letter keys grid
      flex: 1, // Takes most of the keyboardArea height
      position: 'relative', // For absolute positioning of layers inside
  },
  bottomRowContainer: { // Container for 123, Space etc.
      flexDirection: 'row',
      height: 30, // Fixed height for the bottom row
      marginTop: 5, // Space between grid and bottom row
      alignItems: 'center',
      justifyContent: 'space-between', // Space out buttons
      paddingHorizontal: 2, // Slight padding
  },
  key: { // Styles for letter keys
    position: 'absolute',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    margin: 2.5, // Slightly increased margin
    // Shadow/Elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  keyText: { // Text inside letter keys
    fontSize: 19, // Slightly larger
    fontWeight: '400',
    color: '#000',
  },
  bottomButton: { // Styles for Bottom Row Buttons
      height: '100%', // Fill height of bottomRowContainer
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 2,
      backgroundColor: '#adb5bd', // Gray background for function keys
      // Shadow/Elevation
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.20,
      shadowRadius: 1.41,
      elevation: 2,
  },
  toggleButton: {
      flex: 1.5, // Adjust flex proportions as needed
      minWidth: 60,
  },
  spaceButton: {
      flex: 5, // Space takes up more room
  },
  bottomButtonText: {
      fontSize: 16,
      fontWeight: '500',
      color: '#1f2937', // Darker text for contrast
  },
  probabilityText: { // Debug Styles
    fontSize: 8,
    color: '#666',
    position: 'absolute',
    bottom: 1,
    right: 2,
  },
  influenceArea: { // Debug Styles
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: -1,
  },
});
