package dev.hilla.parser.models;

import java.util.Objects;
import java.util.stream.Stream;

import javax.annotation.Nonnull;

import io.github.classgraph.AnnotationEnumValue;

public abstract class AnnotationParameterEnumValueModel implements Model {
    private ClassInfoModel classInfo;

    public static AnnotationParameterEnumValueModel of(
            @Nonnull AnnotationEnumValue origin) {
        return new AnnotationParameterEnumValueSourceModel(
                Objects.requireNonNull(origin));
    }

    public static AnnotationParameterEnumValueModel of(
            @Nonnull Enum<?> origin) {
        return new AnnotationParameterEnumValueReflectionModel(
                Objects.requireNonNull(origin));
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }

        if (!(obj instanceof AnnotationParameterEnumValueModel)) {
            return false;
        }

        var other = (AnnotationParameterEnumValueModel) obj;

        return getClassInfo().equals(other.getClassInfo())
                && getValueName().equals(other.getValueName());
    }

    public ClassInfoModel getClassInfo() {
        if (classInfo == null) {
            classInfo = prepareClassInfo();
        }

        return classInfo;
    }

    @Override
    public Stream<ClassInfoModel> getDependenciesStream() {
        return Stream.of(getClassInfo());
    }

    public abstract String getValueName();

    @Override
    public int hashCode() {
        return getClassInfo().hashCode() + 13 * getValueName().hashCode();
    }

    protected abstract ClassInfoModel prepareClassInfo();
}
